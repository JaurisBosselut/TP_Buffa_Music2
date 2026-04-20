const EVT = {
  cmdSelectTrack: "audio:cmd:selectTrack",
  track: "audio:track",
};

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeItems(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === "string") return { title: x, url: x };
        if (x && typeof x === "object") {
          const url = x.url || x.src;
          if (!url) return null;
          return { title: x.title || String(url), url: String(url) };
        }
        return null;
      })
      .filter(Boolean);
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.tracks)) {
    return normalizeItems(raw.tracks);
  }
  return [];
}

function canonicalUrl(value) {
  const v = String(value || "");
  if (!v) return "";
  try {
    return new URL(v, document.baseURI).toString();
  } catch {
    return v;
  }
}

export class AudioPlaylist extends HTMLElement {
  static get observedAttributes() {
    return ["src", "autoplay", "selected"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._items = [];
    this._selected = "";
    this._shuffle = false;
    this._hostPlayer = null;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .wrap { display: grid; gap: 8px; }
        label { font-size: 12px; opacity: 0.85; }
        select { padding: 6px 8px; max-width: 420px; }
        .controls { display: flex; gap: 6px; flex-wrap: wrap; }
        button { padding: 6px 10px; }
      </style>
      <div class="wrap">
        <label id="label">Playlist</label>
        <div class="controls">
          <button id="prevBtn" type="button">Precedent</button>
          <button id="shuffleBtn" type="button">Shuffle Off</button>
          <button id="nextBtn" type="button">Suivant</button>
        </div>
        <select id="select"></select>
      </div>
    `;

    this._onChange = this._onChange.bind(this);
    this._onTrack = this._onTrack.bind(this);
    this._onEnded = this._onEnded.bind(this);
    this._onPrevClick = this._onPrevClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onShuffleClick = this._onShuffleClick.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.querySelector("#select")?.addEventListener("change", this._onChange);
    this.shadowRoot.querySelector("#prevBtn")?.addEventListener("click", this._onPrevClick);
    this.shadowRoot.querySelector("#nextBtn")?.addEventListener("click", this._onNextClick);
    this.shadowRoot.querySelector("#shuffleBtn")?.addEventListener("click", this._onShuffleClick);
    this._hostPlayer = this.closest("audio-player");
    this._hostPlayer?.addEventListener(EVT.track, this._onTrack);
    this._hostPlayer?.addEventListener("audio:ended", this._onEnded);
    if (this.hasAttribute("src")) this._loadFromSrcAttr();
    this._render();
  }

  disconnectedCallback() {
    this.shadowRoot.querySelector("#select")?.removeEventListener("change", this._onChange);
    this.shadowRoot.querySelector("#prevBtn")?.removeEventListener("click", this._onPrevClick);
    this.shadowRoot.querySelector("#nextBtn")?.removeEventListener("click", this._onNextClick);
    this.shadowRoot.querySelector("#shuffleBtn")?.removeEventListener("click", this._onShuffleClick);
    this._hostPlayer?.removeEventListener(EVT.track, this._onTrack);
    this._hostPlayer?.removeEventListener("audio:ended", this._onEnded);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "src") {
      this._loadFromSrcAttr();
    } else if (name === "selected") {
      this.selected = newValue || "";
    }
  }

  get src() { return this.getAttribute("src") || ""; }
  set src(v) { if (v == null || v === "") this.removeAttribute("src"); else this.setAttribute("src", String(v)); }
  get autoplay() { return this.hasAttribute("autoplay"); }
  set autoplay(v) { if (v) this.setAttribute("autoplay", ""); else this.removeAttribute("autoplay"); }
  get items() { return this._items.map((x) => ({ ...x })); }
  set items(v) { this._items = normalizeItems(v); this._render(); }
  get selected() { return this._selected; }
  set selected(url) { this._selected = String(url || ""); this.setAttribute("selected", this._selected); this._highlightSelected(); }

  async load(url) { this.src = url; await this._loadFromSrcAttr(); }
  selectByIndex(index, { autoplay = this.autoplay } = {}) {
    const i = Number(index);
    const item = this._items[i];
    if (!item) return;
    this._selected = item.url;
    this._highlightSelected();
    this._emitSelect(item, autoplay);
  }
  next({ autoplay = true } = {}) {
    const idx = this._selectedIndex();
    if (idx < 0 && this._items.length > 0) {
      this.selectByIndex(0, { autoplay });
      return;
    }
    if (this._items.length === 0) return;
    if (this._shuffle && this._items.length > 1) {
      const current = canonicalUrl(this._selected);
      const candidates = this._items.filter((it) => canonicalUrl(it.url) !== current);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (!pick) return;
      this._selected = pick.url;
      this._highlightSelected();
      this._emitSelect(pick, autoplay);
      return;
    }
    const nextIdx = (idx + 1) % this._items.length;
    this.selectByIndex(nextIdx, { autoplay });
  }
  previous({ autoplay = true } = {}) {
    const idx = this._selectedIndex();
    if (idx < 0 && this._items.length > 0) {
      this.selectByIndex(0, { autoplay });
      return;
    }
    if (this._items.length === 0) return;
    if (this._shuffle && this._items.length > 1) {
      const current = canonicalUrl(this._selected);
      const candidates = this._items.filter((it) => canonicalUrl(it.url) !== current);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (!pick) return;
      this._selected = pick.url;
      this._highlightSelected();
      this._emitSelect(pick, autoplay);
      return;
    }
    const prevIdx = (idx - 1 + this._items.length) % this._items.length;
    this.selectByIndex(prevIdx, { autoplay });
  }

  _emitSelect(item, autoplay) {
    this.dispatchEvent(new CustomEvent(EVT.cmdSelectTrack, { detail: { url: item.url, title: item.title, autoplay: !!autoplay }, bubbles: true, composed: true }));
  }
  async _loadFromSrcAttr() {
    const url = this.src;
    if (!url) return;
    try {
      const res = await fetch(url);
      const text = await res.text();
      const json = safeJsonParse(text);
      const normalized = normalizeItems(json);
      if (normalized.length > 0) { this._items = normalized; this._render(); }
    } catch {}
  }
  _render() {
    const select = this.shadowRoot.querySelector("#select");
    if (!select) return;
    select.innerHTML = this._items.map((it) => {
      const sel = it.url === this._selected ? "selected" : "";
      return `<option value="${this._escapeAttr(it.url)}" ${sel}>${this._escapeText(it.title)}</option>`;
    }).join("");
    const shuffleBtn = this.shadowRoot.querySelector("#shuffleBtn");
    if (shuffleBtn) shuffleBtn.textContent = this._shuffle ? "Shuffle On" : "Shuffle Off";
    this._highlightSelected();
  }
  _highlightSelected() {
    const select = this.shadowRoot.querySelector("#select");
    if (!select) return;
    const selected = canonicalUrl(this._selected);
    const idx = this._items.findIndex((x) => canonicalUrl(x.url) === selected);
    if (idx >= 0) select.selectedIndex = idx;
  }
  _onChange(e) {
    const url = String(e.target.value || "");
    const item = this._items.find((x) => x.url === url);
    if (!item) return;
    this._selected = item.url;
    this._emitSelect(item, this.autoplay);
  }
  _onTrack(e) {
    const url = e.detail?.url;
    if (typeof url === "string" && url) {
      const selected = canonicalUrl(url);
      const matched = this._items.find((x) => canonicalUrl(x.url) === selected);
      this._selected = matched ? matched.url : url;
      this._highlightSelected();
    }
  }
  _selectedIndex() {
    const selected = canonicalUrl(this._selected);
    return this._items.findIndex((x) => canonicalUrl(x.url) === selected);
  }
  _onEnded() {
    this.next({ autoplay: true });
  }
  _onPrevClick() {
    this.previous({ autoplay: true });
  }
  _onNextClick() {
    this.next({ autoplay: true });
  }
  _onShuffleClick() {
    this._shuffle = !this._shuffle;
    this._render();
  }
  _escapeText(s) { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
  _escapeAttr(s) { return this._escapeText(s).replaceAll('"', "&quot;"); }
}

customElements.define("audio-playlist", AudioPlaylist);

