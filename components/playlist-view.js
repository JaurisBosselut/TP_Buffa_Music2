class PlaylistView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tracks = [];
    this._currentIndex = 0;
  }

  set tracks(value) {
    this._tracks = value || [];
    this.render();
  }

  get tracks() {
    return this._tracks;
  }

  set currentIndex(idx) {
    this._currentIndex = idx;
    this.highlight();
    this.updateCurrentTrackLabel();
  }

  get currentIndex() {
    return this._currentIndex;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .playlist-wrapper {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 10px;
        }
        label {
          font-size: 14px;
          font-weight: 600;
        }
        select {
          padding: 4px 8px;
          font-size: 14px;
          width: auto;
          max-width: 260px;
        }
      </style>
      <div class="playlist-wrapper">
        <label id="currentTrackLabel" for="playlistSelect">Lecture en cours : --</label>
        <select id="playlistSelect">
          ${this._tracks
            .map(
              (t, i) =>
                `<option value="${i}" ${
                  i === this._currentIndex ? "selected" : ""
                }>${t}</option>`
            )
            .join("")}
        </select>
      </div>
    `;

    const select = this.shadowRoot.querySelector("#playlistSelect");
    if (select) {
      select.addEventListener("change", (e) => {
        const index = Number(e.target.value);
        this.dispatchEvent(
          new CustomEvent("track-selected", {
            detail: { index },
            bubbles: true,
            composed: true,
          })
        );
      });
    }

    this.updateCurrentTrackLabel();
  }

  highlight() {
    const select = this.shadowRoot.querySelector("#playlistSelect");
    if (select) {
      select.selectedIndex = this._currentIndex;
    }
  }

  updateCurrentTrackLabel() {
    const label = this.shadowRoot.querySelector("#currentTrackLabel");
    const currentTrack = this._tracks[this._currentIndex] || "--";

    if (label) {
      label.textContent = `Lecture en cours : ${currentTrack}`;
    }
  }
}

customElements.define("playlist-view", PlaylistView);

