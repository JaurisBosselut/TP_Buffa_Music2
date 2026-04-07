export class AudioEngine {
    constructor(audioElement) {
        this.audioContext = new AudioContext();
        this.source = this.audioContext.createMediaElementSource(audioElement);

        // Nodes
        this.eqFrequencies = [60, 170, 350, 1000, 3500, 10000];
        this.eqFilters = this.eqFrequencies.map((frequency) => {
            const eqFilter = this.audioContext.createBiquadFilter();
            eqFilter.type = "peaking";
            eqFilter.frequency.value = frequency;
            eqFilter.Q.value = 1;
            eqFilter.gain.value = 0;
            return eqFilter;
        });

        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = "allpass";

        this.compressorNode = this.audioContext.createDynamicsCompressor();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1;

        this.panner = this.audioContext.createStereoPanner();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        this.convolver = this.audioContext.createConvolver();
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        this.dryGain.gain.value = 1;
        this.wetGain.gain.value = 0;

        this.compressorOn = false;

        this.buildGraph();
        this.loadImpulseResponse("truc.wav");
    }

    buildGraph() {
        this.source.connect(this.eqFilters[0]);
        for (let i = 0; i < this.eqFilters.length - 1; i++) {
            this.eqFilters[i].connect(this.eqFilters[i + 1]);
        }
        this.eqFilters[this.eqFilters.length - 1].connect(this.filter);

        this.connectPostFilterChain();

        this.masterGain.connect(this.panner);
        this.panner.connect(this.analyser);

        this.analyser.connect(this.dryGain);
        this.dryGain.connect(this.audioContext.destination);

        this.analyser.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.audioContext.destination);
    }

    connectPostFilterChain() {
        this.filter.disconnect();
        this.compressorNode.disconnect();

        if (this.compressorOn) {
            this.filter.connect(this.compressorNode);
            this.compressorNode.connect(this.masterGain);
        } else {
            this.filter.connect(this.masterGain);
        }
    }

    async play() {
        await this.audioContext.resume();
        this.source.mediaElement.play();
    }

    pause() {
        this.source.mediaElement.pause();
    }

    setVolume(value) {
        this.masterGain.gain.value = value;
    }

    setPan(value) {
        this.panner.pan.value = value;
    }

    setFilterType(type) {
        this.filter.type = type;
    }

    toggleCompressor() {
        this.compressorOn = !this.compressorOn;
        this.connectPostFilterChain();
    }

    getAnalyser() {
        return this.analyser;
    }

    setFilterFrequency(value) {
        this.filter.frequency.value = value;
    }

    setFilterQ(value) {
        this.filter.Q.value = value;
    }

    setFilterGain(value) {
        this.filter.gain.value = value;
    }

    setFilterDetune(value) {
        this.filter.detune.value = value;
    }

    setReverbMix(value) {
        this.dryGain.gain.value = 1 - value;
        this.wetGain.gain.value = value;
    }

    setEqGain(index, value) {
        if (index < 0 || index >= this.eqFilters.length) {
            return;
        }
        this.eqFilters[index].gain.value = value;
    }

    getEqFrequencies() {
        return [...this.eqFrequencies];
    }

    getFiltersForResponse() {
        return [...this.eqFilters, this.filter];
    }

    async loadImpulseResponse(url) {
        try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            this.convolver.buffer = await this.audioContext.decodeAudioData(buffer);
        } catch (error) {
            console.warn("Could not load impulse response:", error);
        }
    }

}
