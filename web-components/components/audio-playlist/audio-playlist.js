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

export class AudioPlaylist extends HTMLElement {
  static get observedAttributes() {
    return ["src", "autoplay", "selected"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._items = [];
    this._selected = "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .wrap { display: grid; gap: 6px; }
        label { font-size: 12px; opacity: 0.85; }
        select { padding: 6px 8px; max-width: 420px; }
      </style>
      <div class="wrap">
        <label id="label">Playlist</label>
        <select id="select"></select>
      </div>
    `;

    this._onChange = this._onChange.bind(this);
    this._onTrack = this._onTrack.bind(this);
  }

  connectedCallback() {
    this.shadowRoot.querySelector("#select")?.addEventListener("change", this._onChange);
    this.addEventListener(EVT.track, this._onTrack);
    if (this.hasAttribute("src")) this._loadFromSrcAttr();
    this._render();
  }

  disconnectedCallback() {
    this.shadowRoot.querySelector("#select")?.removeEventListener("change", this._onChange);
    this.removeEventListener(EVT.track, this._onTrack);
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
    this._highlightSelected();
  }
  _highlightSelected() {
    const select = this.shadowRoot.querySelector("#select");
    if (!select) return;
    const idx = this._items.findIndex((x) => x.url === this._selected);
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
      this._selected = url;
      this._highlightSelected();
    }
  }
  _escapeText(s) { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
  _escapeAttr(s) { return this._escapeText(s).replaceAll('"', "&quot;"); }
}

customElements.define("audio-playlist", AudioPlaylist);

