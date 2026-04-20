const EVT = {
  cmdSubscribeFreq: "audio:cmd:subscribeFrequency",
  cmdUnsubscribeFreq: "audio:cmd:unsubscribeFrequency",
  frequency: "audio:frequency",
};

function numAttr(el, name, fallback) {
  const v = el.getAttribute(name);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export class AudioVisualizerFrequency extends HTMLElement {
  static get observedAttributes() {
    return ["fft-size", "min-db", "max-db", "smoothing", "bar-color", "bg-color"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._data = null;
    this._raf = null;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        canvas { width: 100%; height: 200px; display:block; border: 1px solid #ddd; border-radius: 8px; background: var(--bg, #fff); }
      </style>
      <canvas id="c" width="600" height="200"></canvas>
    `;
    this._onFrequency = this._onFrequency.bind(this);
    this._draw = this._draw.bind(this);
  }

  connectedCallback() {
    this.addEventListener(EVT.frequency, this._onFrequency);
    this._subscribe();
    this._start();
  }
  disconnectedCallback() {
    this._stop();
    this._unsubscribe();
    this.removeEventListener(EVT.frequency, this._onFrequency);
  }
  attributeChangedCallback() {
    if (this.isConnected) this._subscribe();
  }

  get fftSize() { return numAttr(this, "fft-size", 2048); }
  set fftSize(v) { this.setAttribute("fft-size", String(Number(v))); }
  get minDb() { return numAttr(this, "min-db", -90); }
  set minDb(v) { this.setAttribute("min-db", String(Number(v))); }
  get maxDb() { return numAttr(this, "max-db", -10); }
  set maxDb(v) { this.setAttribute("max-db", String(Number(v))); }
  get smoothing() { return numAttr(this, "smoothing", 0.8); }
  set smoothing(v) { this.setAttribute("smoothing", String(Number(v))); }

  start() { this._start(); }
  stop() { this._stop(); }

  _subscribe() {
    this.dispatchEvent(new CustomEvent(EVT.cmdSubscribeFreq, {
      detail: { target: this, fftSize: this.fftSize, minDb: this.minDb, maxDb: this.maxDb, smoothing: this.smoothing },
      bubbles: true,
      composed: true,
    }));
  }
  _unsubscribe() {
    this.dispatchEvent(new CustomEvent(EVT.cmdUnsubscribeFreq, {
      detail: { target: this },
      bubbles: true,
      composed: true,
    }));
  }
  _onFrequency(e) {
    const arr = e.detail?.data;
    if (!arr) return;
    this._data = arr;
  }
  _start() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(this._draw);
  }
  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
  _draw() {
    this._raf = requestAnimationFrame(this._draw);
    const canvas = this.shadowRoot.querySelector("#c");
    const ctx = canvas.getContext("2d");
    const bg = this.getAttribute("bg-color") || "#fff";
    const bar = this.getAttribute("bar-color") || "#111";
    canvas.style.setProperty("--bg", bg);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const data = this._data;
    if (!data || data.length === 0) return;
    const n = data.length;
    const barWidth = canvas.width / n;
    ctx.fillStyle = bar;
    for (let i = 0; i < n; i++) {
      const v = data[i] / 255;
      const h = v * canvas.height;
      const x = i * barWidth;
      ctx.fillRect(x, canvas.height - h, Math.max(1, barWidth), h);
    }
  }
}

customElements.define("audio-visualizer-frequency", AudioVisualizerFrequency);

