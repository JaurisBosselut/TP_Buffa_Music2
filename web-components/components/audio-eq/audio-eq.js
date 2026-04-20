const EVT = {
  cmdSetEq: "audio:cmd:setEq",
  eq: "audio:eq",
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function parseFrequenciesAttr(v) {
  if (!v) return [60, 170, 350, 1000, 3500, 10000];
  return String(v).split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
}

export class AudioEq extends HTMLElement {
  static get observedAttributes() {
    return ["frequencies", "min-gain", "max-gain", "step"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._bands = [];
    this._minGain = -12;
    this._maxGain = 12;
    this._step = 0.5;
    this._frequencies = [60, 170, 350, 1000, 3500, 10000];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .wrap { display: grid; gap: 10px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
        .band { border: 1px solid #ddd; border-radius: 8px; padding: 8px; background: #fafafa; }
        .f { font-size: 12px; font-weight: 600; margin-bottom: 6px; }
        input[type="range"] { width: 100%; }
        .v { font-size: 12px; opacity: 0.85; }
        button { justify-self: start; padding: 6px 10px; }
      </style>
      <div class="wrap">
        <div class="grid" id="grid"></div>
        <button id="reset" type="button">Reset EQ</button>
      </div>
    `;

    this._onInput = this._onInput.bind(this);
    this._onEqState = this._onEqState.bind(this);
  }

  connectedCallback() {
    this.addEventListener(EVT.eq, this._onEqState);
    this.shadowRoot.querySelector("#reset")?.addEventListener("click", () => this.reset());
    this._syncFromAttributes();
    this._ensureBands();
    this._render();
  }

  disconnectedCallback() {
    this.removeEventListener(EVT.eq, this._onEqState);
    this.shadowRoot.querySelectorAll('input[type="range"]').forEach((el) => el.removeEventListener("input", this._onInput));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this._syncFromAttributes();
    this._ensureBands();
    this._render();
  }

  get frequencies() { return [...this._frequencies]; }
  set frequencies(arr) {
    const f = Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
    if (f.length > 0) {
      this._frequencies = f;
      this.setAttribute("frequencies", f.join(","));
      this._ensureBands();
      this._render();
      this._emit();
    }
  }
  get bands() { return this._bands.map((b) => ({ ...b })); }
  set bands(v) {
    if (!Array.isArray(v)) return;
    const norm = v.map((b) => ({ f: Number(b.f), q: b.q == null ? 1 : Number(b.q), gain: b.gain == null ? 0 : Number(b.gain) })).filter((b) => Number.isFinite(b.f) && b.f > 0);
    if (norm.length === 0) return;
    this._bands = norm;
    this._frequencies = norm.map((b) => b.f);
    this._render();
    this._emit();
  }
  get minGain() { return this._minGain; }
  set minGain(v) { this._minGain = Number(v); this.setAttribute("min-gain", String(this._minGain)); this._render(); }
  get maxGain() { return this._maxGain; }
  set maxGain(v) { this._maxGain = Number(v); this.setAttribute("max-gain", String(this._maxGain)); this._render(); }

  reset() {
    for (const b of this._bands) b.gain = 0;
    this._render();
    this._emit();
  }

  _syncFromAttributes() {
    this._frequencies = parseFrequenciesAttr(this.getAttribute("frequencies"));
    const minG = this.getAttribute("min-gain");
    const maxG = this.getAttribute("max-gain");
    const step = this.getAttribute("step");
    if (minG != null) this._minGain = Number(minG);
    if (maxG != null) this._maxGain = Number(maxG);
    if (step != null) this._step = Number(step);
    if (!Number.isFinite(this._minGain)) this._minGain = -12;
    if (!Number.isFinite(this._maxGain)) this._maxGain = 12;
    if (!Number.isFinite(this._step) || this._step <= 0) this._step = 0.5;
  }
  _ensureBands() {
    if (this._bands.length === this._frequencies.length) {
      for (let i = 0; i < this._bands.length; i++) this._bands[i].f = this._frequencies[i];
      return;
    }
    this._bands = this._frequencies.map((f) => ({ f, q: 1, gain: 0 }));
  }
  _render() {
    const grid = this.shadowRoot.querySelector("#grid");
    if (!grid) return;
    grid.innerHTML = this._bands.map((b, i) => {
      const val = clamp(b.gain, this._minGain, this._maxGain);
      return `<div class="band"><div class="f">${b.f >= 1000 ? (b.f / 1000).toFixed(1) + " kHz" : b.f + " Hz"}</div><input type="range" data-index="${i}" min="${this._minGain}" max="${this._maxGain}" step="${this._step}" value="${val}" /><div class="v"><span id="v${i}">${val.toFixed(1)}</span> dB</div></div>`;
    }).join("");
    this.shadowRoot.querySelectorAll('input[type="range"]').forEach((el) => el.addEventListener("input", this._onInput));
  }
  _onInput(e) {
    const idx = Number(e.target.dataset.index);
    const v = Number(e.target.value);
    if (!Number.isFinite(idx) || !this._bands[idx]) return;
    this._bands[idx].gain = v;
    const label = this.shadowRoot.querySelector(`#v${idx}`);
    if (label) label.textContent = v.toFixed(1);
    this._emit();
  }
  _emit() {
    this.dispatchEvent(new CustomEvent(EVT.cmdSetEq, { detail: { bands: this.bands }, bubbles: true, composed: true }));
  }
  _onEqState(e) {
    const bands = e.detail?.bands;
    if (!Array.isArray(bands)) return;
    this.bands = bands;
  }
}

customElements.define("audio-eq", AudioEq);

