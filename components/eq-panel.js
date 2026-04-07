import "./libs/webaudiocontrols.js";

class EqPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._engine = null;

    this.shadowRoot.innerHTML = `
      <style>
        .controls {
          margin: 4px 0;
        }
        canvas {
          display: block;
          margin-top: 8px;
          border: 1px solid #ccc;
          background: #fafafa;
        }
      </style>
      <div>
        <label>
          Volume:
          <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.5" />
          <span id="volumeValue">volume = 0.5</span>
        </label>
      </div>
      <div>
        <label>
          Balance:
          <input type="range" id="balanceSlider" min="-1" max="1" step="0.01" value="0" />
          <span id="balanceValue">balance = 0</span>
        </label>
      </div>
      <div>
        <label>
          Detune:
          <input id="detuneSlider" type="range" min="-1200" max="1200" step="1" value="0" />
          <span id="detuneValue">detune = 0</span>
        </label>
      </div>
      <div>
        <label>
          Frequency:
          <input id="frequencySlider" type="range" min="100" max="10000" step="1" value="440" />
          <span id="frequencyValue">frequency = 440 Hz</span>
        </label>
      </div>
      <div>
        <label>
          Q:
          <input id="qSlider" type="range" min="0.0001" max="1000" step="0.0001" value="1" />
          <span id="qValue">Q = 1</span>
        </label>
      </div>
      <div>
        <label>
          Gain:
          <input id="filterGainSlider" type="range" min="-30" max="30" step="1" value="0" />
          <span id="gainValue">gain = 0 dB</span>
        </label>
      </div>
      <div>
        <label>
          Type:
          <select id="filterType">
            <option value="allpass">allpass</option>
            <option value="lowpass">lowpass</option>
            <option value="highpass">highpass</option>
            <option value="bandpass">bandpass</option>
            <option value="lowshelf">lowshelf</option>
            <option value="highshelf">highshelf</option>
            <option value="peaking">peaking</option>
            <option value="notch">notch</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Reverb:
          <input id="reverbSlider" type="range" min="0" max="1" step="0.01" value="0" />
          <span id="reverbValue">reverb = 0</span>
        </label>
      </div>
      <div>
        <button id="compressorButton">Turn Compressor On</button>
      </div>
      <h3>6-Band Equalizer</h3>
      <div id="eqBands"></div>
      <h3>Frequency response</h3>
      <canvas id="responseCanvas" width="600" height="300"></canvas>
    `;

    this._frequencyRenderer = null;
  }

  set engine(engine) {
    this._engine = engine;
    this.renderEqBands();
    this.setupFrequencyRenderer();
    this.attachListeners();
  }

  get engine() {
    return this._engine;
  }

  setupFrequencyRenderer() {
    if (!this._engine) return;

    const canvas = this.shadowRoot.querySelector("#responseCanvas");
    if (!canvas) return;

    const audioContext = this._engine.audioContext;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const curveColor = "rgb(224,27,106)";
    const gridColor = "rgb(100,100,100)";
    const textColor = "rgb(81,127,207)";

    const dbScale = 60;
    let pixelsPerDb = (0.5 * height) / dbScale;

    const dbToY = (db) => 0.5 * height - pixelsPerDb * db;

    function drawGrid(nyquist, noctaves) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      for (let octave = 0; octave <= noctaves; octave++) {
        let x = (octave * width) / noctaves;
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x, height);
        ctx.stroke();

        let f = nyquist * Math.pow(2, octave - noctaves);
        let label =
          f >= 1000 ? (f / 1000).toFixed(1) + "kHz" : f.toFixed(0) + "Hz";

        ctx.strokeStyle = textColor;
        ctx.textAlign = "center";
        ctx.strokeText(label, x, 20);
        ctx.strokeStyle = gridColor;
      }

      ctx.beginPath();
      ctx.moveTo(0, 0.5 * height);
      ctx.lineTo(width, 0.5 * height);
      ctx.stroke();

      for (let db = -dbScale; db <= dbScale; db += 10) {
        let y = dbToY(db);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.strokeStyle = textColor;
        ctx.strokeText(db + " dB", width - 40, y);
        ctx.strokeStyle = gridColor;
      }
    }

    this._frequencyRenderer = (filters) => {
      if (!filters || filters.length === 0) return;

      ctx.clearRect(0, 0, width, height);

      const nyquist = 0.5 * audioContext.sampleRate;
      const noctaves = 11;

      const frequencyHz = new Float32Array(width);
      const magResponse = new Float32Array(width);
      const phaseResponse = new Float32Array(width);

      for (let i = 0; i < width; i++) {
        let f = i / width;
        frequencyHz[i] = nyquist * Math.pow(2, noctaves * (f - 1));
        magResponse[i] = 1;
      }

      filters.forEach((filt) => {
        const tmpMag = new Float32Array(width);
        filt.getFrequencyResponse(frequencyHz, tmpMag, phaseResponse);
        for (let i = 0; i < width; i++) {
          magResponse[i] *= tmpMag[i];
        }
      });

      drawGrid(nyquist, noctaves);

      ctx.beginPath();
      ctx.strokeStyle = curveColor;
      ctx.lineWidth = 3;

      for (let i = 0; i < width; i++) {
        const db = 20 * Math.log10(magResponse[i]);
        const x = i;
        const y = dbToY(db);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    };

    this.updateFrequencyResponse();
  }

  updateFrequencyResponse() {
    if (!this._engine || !this._frequencyRenderer) return;
    this._frequencyRenderer(this._engine.getFiltersForResponse());
  }

  renderEqBands() {
    if (!this._engine) return;

    const eqBandsContainer = this.shadowRoot.querySelector("#eqBands");
    const frequencies = this._engine.getEqFrequencies();

    eqBandsContainer.innerHTML = frequencies
      .map(
        (frequency, index) => `
          <div class="controls">
            <label>${frequency}Hz</label>
            <input
              type="range"
              class="eqBandSlider"
              data-index="${index}"
              min="-30"
              max="30"
              step="1"
              value="0"
            />
            <span id="eqBandValue${index}">0 dB</span>
          </div>
        `
      )
      .join("");
  }

  attachListeners() {
    if (!this._engine) return;

    const volumeSlider = this.shadowRoot.querySelector("#volumeSlider");
    const volumeValue = this.shadowRoot.querySelector("#volumeValue");
    const balanceSlider = this.shadowRoot.querySelector("#balanceSlider");
    const balanceValue = this.shadowRoot.querySelector("#balanceValue");
    const detuneSlider = this.shadowRoot.querySelector("#detuneSlider");
    const detuneValue = this.shadowRoot.querySelector("#detuneValue");
    const frequencySlider = this.shadowRoot.querySelector("#frequencySlider");
    const frequencyValue = this.shadowRoot.querySelector("#frequencyValue");
    const qSlider = this.shadowRoot.querySelector("#qSlider");
    const qValue = this.shadowRoot.querySelector("#qValue");
    const gainSlider = this.shadowRoot.querySelector("#filterGainSlider");
    const gainValue = this.shadowRoot.querySelector("#gainValue");
    const filterTypeSelect = this.shadowRoot.querySelector("#filterType");
    const reverbSlider = this.shadowRoot.querySelector("#reverbSlider");
    const reverbValue = this.shadowRoot.querySelector("#reverbValue");
    const compressorButton = this.shadowRoot.querySelector("#compressorButton");
    const eqBandSliders = this.shadowRoot.querySelectorAll(".eqBandSlider");

    volumeSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setVolume(value);
      volumeValue.textContent = `volume = ${value}`;
    });

    balanceSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setPan(value);
      balanceValue.textContent = `balance = ${value}`;
    });

    detuneSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setFilterDetune(value);
      detuneValue.textContent = `detune = ${value}`;
      this.updateFrequencyResponse();
    });

    frequencySlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setFilterFrequency(value);
      frequencyValue.textContent = `frequency = ${value} Hz`;
      this.updateFrequencyResponse();
    });

    qSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setFilterQ(value);
      qValue.textContent = `Q = ${value}`;
      this.updateFrequencyResponse();
    });

    gainSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setFilterGain(value);
      gainValue.textContent = `gain = ${value} dB`;
      this.updateFrequencyResponse();
    });

    filterTypeSelect.addEventListener("change", (e) => {
      this._engine.setFilterType(e.target.value);
      this.updateFrequencyResponse();
    });

    reverbSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      this._engine.setReverbMix(value);
      reverbValue.textContent = `reverb = ${value}`;
    });

    eqBandSliders.forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const index = Number(e.target.dataset.index);
        const value = parseFloat(e.target.value);
        this._engine.setEqGain(index, value);

        const valueLabel = this.shadowRoot.querySelector(`#eqBandValue${index}`);
        if (valueLabel) {
          valueLabel.textContent = `${value} dB`;
        }

        this.updateFrequencyResponse();
      });
    });

    compressorButton.addEventListener("click", () => {
      this._engine.toggleCompressor();
      compressorButton.textContent = this._engine.compressorOn
        ? "Turn Compressor Off"
        : "Turn Compressor On";
    });
  } 
}

customElements.define("eq-panel", EqPanel);

C:\Users\jauri\Downloads\Tp Buffa\TP 1\mon tp\TP_Buffa_Music\lecteurAudioWebComponent\components\eq-panel.js