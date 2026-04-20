const EVT = {
  cmdPlay: "audio:cmd:play",
  cmdPause: "audio:cmd:pause",
  cmdToggle: "audio:cmd:toggle",
  cmdSeek: "audio:cmd:seek",
  cmdSetVolume: "audio:cmd:setVolume",
  cmdSetMuted: "audio:cmd:setMuted",
  cmdSelectTrack: "audio:cmd:selectTrack",
  cmdSetEq: "audio:cmd:setEq",
  cmdSubscribeFreq: "audio:cmd:subscribeFrequency",
  cmdUnsubscribeFreq: "audio:cmd:unsubscribeFrequency",
  ready: "audio:ready",
  state: "audio:state",
  track: "audio:track",
  time: "audio:time",
  eq: "audio:eq",
  frequency: "audio:frequency",
  error: "audio:error",
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function toBoolAttr(v) {
  return v === "" || v === "true" || v === true;
}

export class AudioPlayer extends HTMLElement {
  static get observedAttributes() {
    return ["src", "volume", "muted", "autoplay"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._ctx = null;
    this._sourceNode = null;
    this._masterGain = null;
    this._analyser = null;
    this._eqFilters = [];
    this._eqConfig = [
      { f: 60, q: 1, gain: 0 },
      { f: 170, q: 1, gain: 0 },
      { f: 350, q: 1, gain: 0 },
      { f: 1000, q: 1, gain: 0 },
      { f: 3500, q: 1, gain: 0 },
      { f: 10000, q: 1, gain: 0 },
    ];

    this._freqSubscribers = new Map();
    this._freqRaf = null;
    this._lastTimeEventTs = 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .wrap { display: grid; gap: 10px; }
        .bar { display: grid; grid-template-columns: auto auto 1fr auto; gap: 8px; align-items: center; }
        button { padding: 6px 10px; }
        input[type="range"] { width: 100%; }
        .time { font-variant-numeric: tabular-nums; font-size: 12px; opacity: 0.85; }
        .slot { display: block; }
        audio { display: none; }
      </style>
      <div class="wrap">
        <div class="bar">
          <button id="toggleBtn" type="button">Play</button>
          <button id="muteBtn" type="button">Mute</button>
          <input id="seek" type="range" min="0" max="1" step="0.001" value="0" />
          <span class="time" id="time">0:00 / 0:00</span>
        </div>
        <div class="bar" style="grid-template-columns: auto 1fr auto;">
          <span class="time">Volume</span>
          <input id="volume" type="range" min="0" max="1" step="0.01" value="1" />
          <span class="time" id="volLabel">1.00</span>
        </div>
        <div class="slot">
          <slot></slot>
        </div>
        <audio id="audio" crossorigin="anonymous"></audio>
      </div>
    `;

    this._onCmd = this._onCmd.bind(this);
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._onDurationChange = this._onDurationChange.bind(this);
    this._onPlayPause = this._onPlayPause.bind(this);
    this._onEnded = this._onEnded.bind(this);
  }

  connectedCallback() {
    this.addEventListener(EVT.cmdPlay, this._onCmd);
    this.addEventListener(EVT.cmdPause, this._onCmd);
    this.addEventListener(EVT.cmdToggle, this._onCmd);
    this.addEventListener(EVT.cmdSeek, this._onCmd);
    this.addEventListener(EVT.cmdSetVolume, this._onCmd);
    this.addEventListener(EVT.cmdSetMuted, this._onCmd);
    this.addEventListener(EVT.cmdSelectTrack, this._onCmd);
    this.addEventListener(EVT.cmdSetEq, this._onCmd);
    this.addEventListener(EVT.cmdSubscribeFreq, this._onCmd);
    this.addEventListener(EVT.cmdUnsubscribeFreq, this._onCmd);

    const audio = this._audioEl();
    audio.addEventListener("timeupdate", this._onTimeUpdate);
    audio.addEventListener("durationchange", this._onDurationChange);
    audio.addEventListener("play", this._onPlayPause);
    audio.addEventListener("pause", this._onPlayPause);
    audio.addEventListener("ended", this._onEnded);

    this.shadowRoot.querySelector("#toggleBtn")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent(EVT.cmdToggle, { bubbles: true, composed: true }));
    });
    this.shadowRoot.querySelector("#muteBtn")?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent(EVT.cmdSetMuted, {
          detail: { value: !this.muted },
          bubbles: true,
          composed: true,
        })
      );
    });
    this.shadowRoot.querySelector("#seek")?.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      const d = audio.duration || 0;
      if (Number.isFinite(d) && d > 0) {
        this.seek(v * d);
      }
    });
    this.shadowRoot.querySelector("#volume")?.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      this.volume = v;
    });

    if (this.hasAttribute("src")) {
      this.src = this.getAttribute("src") || "";
    }
    if (this.hasAttribute("volume")) {
      this.volume = Number(this.getAttribute("volume"));
    }
    if (this.hasAttribute("muted")) {
      this.muted = toBoolAttr(this.getAttribute("muted"));
    }

    this._renderState();
    this._emit(EVT.ready, {});

    if (this.autoplay && this.src) {
      this.play().catch(() => {});
    }
  }

  disconnectedCallback() {
    this.removeEventListener(EVT.cmdPlay, this._onCmd);
    this.removeEventListener(EVT.cmdPause, this._onCmd);
    this.removeEventListener(EVT.cmdToggle, this._onCmd);
    this.removeEventListener(EVT.cmdSeek, this._onCmd);
    this.removeEventListener(EVT.cmdSetVolume, this._onCmd);
    this.removeEventListener(EVT.cmdSetMuted, this._onCmd);
    this.removeEventListener(EVT.cmdSelectTrack, this._onCmd);
    this.removeEventListener(EVT.cmdSetEq, this._onCmd);
    this.removeEventListener(EVT.cmdSubscribeFreq, this._onCmd);
    this.removeEventListener(EVT.cmdUnsubscribeFreq, this._onCmd);

    const audio = this._audioEl();
    audio.removeEventListener("timeupdate", this._onTimeUpdate);
    audio.removeEventListener("durationchange", this._onDurationChange);
    audio.removeEventListener("play", this._onPlayPause);
    audio.removeEventListener("pause", this._onPlayPause);
    audio.removeEventListener("ended", this._onEnded);
    this._stopFrequencyLoop();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "src") this.src = newValue || "";
    else if (name === "volume") this.volume = Number(newValue);
    else if (name === "muted") this.muted = toBoolAttr(newValue);
  }

  get src() {
    return this._audioEl().currentSrc || this._audioEl().src || "";
  }
  set src(value) {
    const v = String(value || "");
    this.setAttribute("src", v);
    const audio = this._audioEl();
    audio.src = v;
    this._emit(EVT.track, { url: v, title: this._guessTitleFromUrl(v), duration: audio.duration || null });
    this._renderState();
  }
  get autoplay() { return this.hasAttribute("autoplay"); }
  set autoplay(v) { if (v) this.setAttribute("autoplay", ""); else this.removeAttribute("autoplay"); }
  get muted() { return this._audioEl().muted; }
  set muted(v) {
    const b = !!v;
    this._audioEl().muted = b;
    if (b) this.setAttribute("muted", ""); else this.removeAttribute("muted");
    this._renderState();
  }
  get volume() { return this._audioEl().volume; }
  set volume(v) {
    const val = clamp(Number(v), 0, 1);
    this._audioEl().volume = val;
    this.setAttribute("volume", String(val));
    if (this._masterGain) this._masterGain.gain.value = val;
    this._renderState();
  }
  get currentTime() { return this._audioEl().currentTime || 0; }
  get duration() { return this._audioEl().duration || 0; }
  get paused() { return this._audioEl().paused; }
  get audioContext() { return this._ctx; }

  async load(url, { autoplay = false } = {}) {
    this.src = url;
    if (autoplay) await this.play();
  }
  async play() {
    await this._ensureAudioGraph();
    try {
      await this._ctx.resume();
      await this._audioEl().play();
      this._renderState();
    } catch (err) {
      this._emit(EVT.error, { message: String(err?.message || err) });
      throw err;
    }
  }
  pause() { this._audioEl().pause(); this._renderState(); }
  toggle() { if (this.paused) return this.play(); this.pause(); return Promise.resolve(); }
  seek(timeSeconds) {
    const audio = this._audioEl();
    const d = audio.duration || 0;
    const t = clamp(Number(timeSeconds), 0, Number.isFinite(d) && d > 0 ? d : 1e12);
    audio.currentTime = t;
    this._emit(EVT.time, { currentTime: audio.currentTime, duration: audio.duration || null });
    this._renderState();
  }
  setEqBands(bands) {
    if (!Array.isArray(bands) || bands.length === 0) return;
    this._eqConfig = bands.map((b) => ({ f: Number(b.f), q: b.q == null ? 1 : Number(b.q), gain: b.gain == null ? 0 : Number(b.gain) }))
      .filter((b) => Number.isFinite(b.f) && b.f > 0);
    if (this._eqFilters.length > 0) this._applyEqConfigToNodes();
    this._emit(EVT.eq, { bands: this.getEqBands() });
  }
  getEqBands() { return this._eqConfig.map((b) => ({ ...b })); }

  _audioEl() { return this.shadowRoot.querySelector("#audio"); }
  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
  _emitState() {
    const a = this._audioEl();
    this._emit(EVT.state, { paused: a.paused, muted: a.muted, volume: a.volume, src: a.currentSrc || a.src || "", currentTime: a.currentTime || 0, duration: Number.isFinite(a.duration) ? a.duration : null });
  }
  _guessTitleFromUrl(url) {
    try { const name = decodeURIComponent(String(url).split("/").pop() || ""); return name || url; }
    catch { return url; }
  }
  async _ensureAudioGraph() {
    if (this._ctx && this._sourceNode) return;
    const audio = this._audioEl();
    this._ctx = new AudioContext();
    this._sourceNode = this._ctx.createMediaElementSource(audio);
    this._eqFilters = this._eqConfig.map((b) => {
      const f = this._ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = b.f;
      f.Q.value = b.q;
      f.gain.value = b.gain;
      return f;
    });
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this.volume;
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    this._analyser.minDecibels = -90;
    this._analyser.maxDecibels = -10;
    this._analyser.smoothingTimeConstant = 0.8;
    let node = this._sourceNode;
    for (const eq of this._eqFilters) { node.connect(eq); node = eq; }
    node.connect(this._masterGain);
    this._masterGain.connect(this._analyser);
    this._analyser.connect(this._ctx.destination);
    this._emit(EVT.ready, { sampleRate: this._ctx.sampleRate });
    this._emit(EVT.eq, { bands: this.getEqBands() });
  }
  _applyEqConfigToNodes() {
    for (let i = 0; i < this._eqFilters.length; i++) {
      const b = this._eqConfig[i];
      const f = this._eqFilters[i];
      if (!b || !f) continue;
      f.frequency.value = b.f;
      f.Q.value = b.q;
      f.gain.value = b.gain;
    }
  }
  _renderState() {
    const audio = this._audioEl();
    const btn = this.shadowRoot.querySelector("#toggleBtn");
    if (btn) btn.textContent = audio.paused ? "Play" : "Pause";
    const muteBtn = this.shadowRoot.querySelector("#muteBtn");
    if (muteBtn) muteBtn.textContent = audio.muted ? "Unmute" : "Mute";
    const vol = this.shadowRoot.querySelector("#volume");
    if (vol) vol.value = String(audio.volume);
    const volLabel = this.shadowRoot.querySelector("#volLabel");
    if (volLabel) volLabel.textContent = Number(audio.volume).toFixed(2);
    const seek = this.shadowRoot.querySelector("#seek");
    const d = audio.duration || 0;
    const ct = audio.currentTime || 0;
    if (seek) {
      seek.disabled = !(Number.isFinite(d) && d > 0);
      seek.value = Number.isFinite(d) && d > 0 ? String(ct / d) : "0";
    }
    const time = this.shadowRoot.querySelector("#time");
    if (time) time.textContent = `${this._fmtTime(ct)} / ${this._fmtTime(d)}`;
    this._emitState();
  }
  _fmtTime(sec) {
    const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  _onTimeUpdate() {
    const now = performance.now();
    if (now - this._lastTimeEventTs > 100) {
      this._lastTimeEventTs = now;
      const a = this._audioEl();
      this._emit(EVT.time, { currentTime: a.currentTime || 0, duration: a.duration || null });
    }
    this._renderState();
  }
  _onDurationChange() {
    const a = this._audioEl();
    this._emit(EVT.track, { url: a.currentSrc || a.src || "", title: this._guessTitleFromUrl(a.currentSrc || a.src || ""), duration: Number.isFinite(a.duration) ? a.duration : null });
    this._renderState();
  }
  _onPlayPause() { this._renderState(); if (!this.paused) this._startFrequencyLoopIfNeeded(); }
  _onEnded() { this._renderState(); this._emit("audio:ended", { src: this.src }); }
  async _onCmd(e) {
    try {
      if (e.type === EVT.cmdPlay) await this.play();
      else if (e.type === EVT.cmdPause) this.pause();
      else if (e.type === EVT.cmdToggle) await this.toggle();
      else if (e.type === EVT.cmdSeek) this.seek(e.detail?.time);
      else if (e.type === EVT.cmdSetVolume) this.volume = e.detail?.value;
      else if (e.type === EVT.cmdSetMuted) this.muted = !!e.detail?.value;
      else if (e.type === EVT.cmdSelectTrack) {
        const url = e.detail?.url || e.detail?.src;
        if (url) await this.load(url, { autoplay: e.detail?.autoplay ?? true });
      } else if (e.type === EVT.cmdSetEq) {
        const bands = e.detail?.bands;
        if (Array.isArray(bands)) this.setEqBands(bands);
      } else if (e.type === EVT.cmdSubscribeFreq) {
        const target = e.detail?.target;
        if (target instanceof HTMLElement) {
          const cfg = { fftSize: e.detail?.fftSize, minDb: e.detail?.minDb, maxDb: e.detail?.maxDb, smoothing: e.detail?.smoothing };
          this._freqSubscribers.set(target, cfg);
          await this._ensureAudioGraph();
          this._applyAnalyserConfigFromSubscribers();
          this._startFrequencyLoopIfNeeded();
        }
      } else if (e.type === EVT.cmdUnsubscribeFreq) {
        const target = e.detail?.target;
        if (target instanceof HTMLElement) {
          this._freqSubscribers.delete(target);
          if (this._freqSubscribers.size === 0) this._stopFrequencyLoop();
        }
      }
    } catch (err) {
      this._emit(EVT.error, { message: String(err?.message || err) });
    }
  }
  _applyAnalyserConfigFromSubscribers() {
    if (!this._analyser) return;
    const first = this._freqSubscribers.values().next().value;
    if (!first) return;
    if (first.fftSize) this._analyser.fftSize = Number(first.fftSize);
    if (first.minDb != null) this._analyser.minDecibels = Number(first.minDb);
    if (first.maxDb != null) this._analyser.maxDecibels = Number(first.maxDb);
    if (first.smoothing != null) this._analyser.smoothingTimeConstant = clamp(Number(first.smoothing), 0, 1);
  }
  _startFrequencyLoopIfNeeded() {
    if (!this._analyser || this._freqSubscribers.size === 0 || this._freqRaf) return;
    const draw = () => {
      this._freqRaf = requestAnimationFrame(draw);
      if (this.paused || !this._analyser) return;
      const bins = this._analyser.frequencyBinCount;
      const arr = new Uint8Array(bins);
      this._analyser.getByteFrequencyData(arr);
      const payload = { data: arr, sampleRate: this._ctx?.sampleRate ?? null };
      for (const target of this._freqSubscribers.keys()) {
        target.dispatchEvent(new CustomEvent(EVT.frequency, { detail: payload, bubbles: false, composed: false }));
      }
    };
    this._freqRaf = requestAnimationFrame(draw);
  }
  _stopFrequencyLoop() { if (this._freqRaf) cancelAnimationFrame(this._freqRaf); this._freqRaf = null; }
}

customElements.define("audio-player", AudioPlayer);

