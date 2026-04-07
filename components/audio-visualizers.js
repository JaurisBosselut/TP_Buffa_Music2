class WaveformVisualizer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <canvas id="waveformCanvas" width="600" height="200"></canvas>
    `;
    this._analyser = null;
    this._animationId = null;
  }

  set analyser(node) {
    this._analyser = node;
    if (node) {
      this.start();
    }
  }

  get analyser() {
    return this._analyser;
  }

  start() {
    if (!this._analyser) return;

    const canvas = this.shadowRoot.querySelector("#waveformCanvas");
    const ctx = canvas.getContext("2d");

    const bufferLength = this._analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this._animationId = requestAnimationFrame(draw);

      this._analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgb(0, 200, 255)";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.stroke();
    };

    draw();
  }

  disconnectedCallback() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
  }
}

customElements.define("waveform-visualizer", WaveformVisualizer);

class FrequencyVisualizer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <canvas id="frequencyCanvas" width="600" height="200"></canvas>
    `;
    this._analyser = null;
    this._animationId = null;
  }

  set analyser(node) {
    this._analyser = node;
    if (node) {
      this.start();
    }
  }

  get analyser() {
    return this._analyser;
  }

  start() {
    if (!this._analyser) return;

    const canvas = this.shadowRoot.querySelector("#frequencyCanvas");
    const ctx = canvas.getContext("2d");

    const bufferLength = this._analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this._animationId = requestAnimationFrame(draw);

      this._analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255) * canvas.height;

        ctx.fillStyle = "rgb(0, 0, 0)";
        ctx.fillRect(
          x,
          canvas.height - barHeight,
          barWidth,
          barHeight
        );

        x += barWidth + 1;
      }
    };

    draw();
  }

  disconnectedCallback() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
  }
}

customElements.define("frequency-visualizer", FrequencyVisualizer);

class VuMeter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <canvas id="volumeCanvas" width="80" height="200"></canvas>
    `;
    this._analyser = null;
    this._animationId = null;
  }

  set analyser(node) {
    this._analyser = node;
    if (node) {
      this.start();
    }
  }

  get analyser() {
    return this._analyser;
  }

  start() {
    if (!this._analyser) return;

    const canvas = this.shadowRoot.querySelector("#volumeCanvas");
    const ctx = canvas.getContext("2d");

    const bufferLength = this._analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this._animationId = requestAnimationFrame(draw);

      this._analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / bufferLength);

      const volumeHeight = rms * canvas.height * 1.4;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let color = "green";
      if (rms > 0.5) color = "orange";
      if (rms > 0.75) color = "red";

      ctx.fillStyle = color;
      ctx.fillRect(
        0,
        canvas.height - volumeHeight,
        canvas.width,
        volumeHeight
      );
    };

    draw();
  }

  disconnectedCallback() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
  }
}

customElements.define("vu-meter", VuMeter);

