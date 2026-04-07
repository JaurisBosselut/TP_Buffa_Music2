// ici un web component qui encapsule un lecteur audio HTLML5 basique
import "./libs/webaudiocontrols.js";
import { AudioEngine } from "./audio-engine.js";
import "./eq-panel.js";
import "./audio-visualizers.js";
import "./playlist-view.js";

let style = `
<style>
    audio {
        border: 2px solid #333;
        border-radius: 5px;
        padding: 5px;
        background-color: #f0f0f0;
    }

    #visualizers {
        display: flex;
        gap: 20px;              /* espace entre les deux */
        align-items: flex-start;
        margin-top: 20px;
    }

    #visualization_waveform,
    #visualization_frequency,#visualization_volume {
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 1px solid #ccc;
        padding: 10px;
        background-color: #fafafa;
    }


</style>
`;
let html = `
    <playlist-view></playlist-view>

  <audio id="myplayer" src=""></audio>
  <button id="playbtn">Play</button>
  <button id="pausebtn">Pause</button>
  <button id="prevBtn">⏮ Prev</button>
  <button id="nextBtn">⏭ Next</button>
  <button id="shuffleBtn">🔀 Shuffle OFF</button>

  <eq-panel></eq-panel>

  <div id="visualizers">
    <div id="visualization_waveform">
      <h2>2D audio visualization: waveform</h2>
      <waveform-visualizer></waveform-visualizer>
    </div>

    <div id="visualization_frequency">
      <h2>2D audio visualization: frequency</h2>
      <frequency-visualizer></frequency-visualizer>
    </div>

    <div id="visualization_volume">
      <h2>Volume (VU meter)</h2>
      <vu-meter></vu-meter>
    </div>
  </div>
`;


class MyAudioPlayer extends HTMLElement {
    constructor() {
        super();
        // On crée un shadow DOM: le HTML contenu dans le shadow DOM ne sera pas affecté par 
        // les styles CSS de la page hôte, et ne sera visible dans le debugger que si on coche 
        // la case dans les options du debugger "Show user agent shadow DOM"
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = style + html;

        // On récupère l'attribut src qui contient l'URL du fichier audio à lire
        this.src = this.getAttribute('src');
        console.log("AudioPlayer: src attribute = ", this.src);
        this.audioContext = new AudioContext();
    }  


    setSource(newSrc) {
        this.src = newSrc; // met à jour l'attribut interne
        const audioElement = this.shadowRoot.querySelector('#myplayer');
        audioElement.src = newSrc;
        audioElement.play(); // optional : démarre la musique immédiatement
    }


    connectedCallback() {
        const audioElement = this.shadowRoot.querySelector('#myplayer');
        this.engine = new AudioEngine(audioElement);
        const analyser = this.engine.getAnalyser();

        const eqPanel = this.shadowRoot.querySelector('eq-panel');
        if (eqPanel) {
            eqPanel.engine = this.engine;
        }

        const waveform = this.shadowRoot.querySelector('waveform-visualizer');
        if (waveform) {
            waveform.analyser = analyser;
        }

        const frequencyVis = this.shadowRoot.querySelector('frequency-visualizer');
        if (frequencyVis) {
            frequencyVis.analyser = analyser;
        }

        const vuMeter = this.shadowRoot.querySelector('vu-meter');
        if (vuMeter) {
            vuMeter.analyser = analyser;
        }

        // playlist interne au composant (indépendante de la page hôte)
        this.playlist = [
            "Rebel_Heart.mp3",
            "The_Line.mp3",
            "To_Ashes_and_Blood.mp3",
            "Ma_Meilleure_Ennemie.mp3",
            "Pokemon.mp3",
            "Pokemon1.mp3",
            "Pokemon2.mp3",
            "Pokemon3.mp3",
            "Pokemon4.mp3",
            "Fairytale (Alexander Rybak).mp3",
            "End Of Beginning (Djo).mp3",
            "Die With A Smile (Lady Gaga, Bruno Mars).mp3",
            "Daylight (David Kushner).mp3",
            "Human (Rag'n'Bone Man).mp3",
            "Believer (Imagine Dragons).mp3",
            "Natural (Imagine Dragons).mp3",
            "Enemy (Imagine Dragons).mp3",
            "God knows... The Melancholy of Haruhi Suzumiya.mp3",
        ];
        this.currentIndex = 0;
        this.shuffle = false;
        this.history = [];

        // on démarre toujours sur le premier morceau de la playlist
        audioElement.src = this.playlist[this.currentIndex];

        this.playlistView = this.shadowRoot.querySelector('playlist-view');
        if (this.playlistView) {
            this.playlistView.tracks = this.playlist;
            this.playlistView.currentIndex = this.currentIndex;
        }

        this.defineListeners();

    }

    defineListeners() {
        const audioElement = this.shadowRoot.querySelector('#myplayer');
        const playButton = this.shadowRoot.querySelector('#playbtn');
        const pauseButton = this.shadowRoot.querySelector('#pausebtn');
        const nextBtn = this.shadowRoot.querySelector('#nextBtn');
        const prevBtn = this.shadowRoot.querySelector('#prevBtn');
        const shuffleBtn = this.shadowRoot.querySelector('#shuffleBtn');

        shuffleBtn.addEventListener('click', () => {
            this.shuffle = !this.shuffle;
            shuffleBtn.textContent = this.shuffle ? "🔀 Shuffle ON" : "🔀 Shuffle OFF";
        });

        /* =========================
        TRACK LOADING AND NAVIGATION
        ========================= */

        const loadTrack = (index) => {
            if (this.currentIndex !== index) {
                this.history.push(this.currentIndex);
            }

            this.currentIndex = index;
            const track = this.playlist[this.currentIndex];
            audioElement.src = track;
            audioElement.play();

            if (this.playlistView) {
                this.playlistView.currentIndex = this.currentIndex;
            }
        };


        const nextTrack = () => {
            if (this.shuffle) {
                let next;
                do {
                    next = Math.floor(Math.random() * this.playlist.length);
                } while (next === this.currentIndex);
                loadTrack(next);
            } else {
                loadTrack((this.currentIndex + 1) % this.playlist.length);
            }
        };

        const prevTrack = () => {
            if (this.shuffle && this.history.length > 0) {
                const previousIndex = this.history.pop();
                this.currentIndex = previousIndex;
                audioElement.src = this.playlist[this.currentIndex];
                audioElement.play();
            } else {
                loadTrack(
                    (this.currentIndex - 1 + this.playlist.length) % this.playlist.length
                );
            }
        };

        nextBtn.addEventListener('click', nextTrack);
        prevBtn.addEventListener('click', prevTrack);

        /* =========================
        UI LISTENERS
        ========================= */

        playButton.addEventListener('click', () => {
            this.engine.play();
        });

        pauseButton.addEventListener('click', () => {
            this.engine.pause();
        });

        audioElement.addEventListener('ended', () => {
            nextTrack();
            if (this.playlistView) {
                this.playlistView.currentIndex = this.currentIndex;
            }
        });

        if (this.playlistView) {
            this.shadowRoot.addEventListener('track-selected', (e) => {
                const index = e.detail.index;
                loadTrack(index);
                this.playlistView.currentIndex = this.currentIndex;
            });
        }
    }


    FilterFrequencyResponseRenderer(canvas, audioCxt) {
        const ctx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;

        const audioContext = audioCxt;

        const curveColor = "rgb(224,27,106)";
        const gridColor = "rgb(100,100,100)";
        const textColor = "rgb(81,127,207)";

        const dbScale = 60;
        let pixelsPerDb = (0.5 * height) / dbScale;

        const dbToY = db => (0.5 * height) - pixelsPerDb * db;

        function drawGrid(nyquist, noctaves) {
            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 1;

            // lignes verticales (fréquences)
            for (let octave = 0; octave <= noctaves; octave++) {
                let x = octave * width / noctaves;
                ctx.beginPath();
                ctx.moveTo(x, 30);
                ctx.lineTo(x, height);
                ctx.stroke();

                let f = nyquist * Math.pow(2, octave - noctaves);
                let label = f >= 1000 ? (f / 1000).toFixed(1) + "kHz" : f.toFixed(0) + "Hz";

                ctx.strokeStyle = textColor;
                ctx.textAlign = "center";
                ctx.strokeText(label, x, 20);
                ctx.strokeStyle = gridColor;
            }

            // ligne 0dB
            ctx.beginPath();
            ctx.moveTo(0, 0.5 * height);
            ctx.lineTo(width, 0.5 * height);
            ctx.stroke();

            // lignes dB
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

        function draw(filters) {
            ctx.clearRect(0, 0, width, height);

            const nyquist = 0.5 * audioContext.sampleRate;
            const noctaves = 11;

            const frequencyHz = new Float32Array(width);
            const magResponse = new Float32Array(width);
            const phaseResponse = new Float32Array(width);

            // init fréquences + magnitude
            for (let i = 0; i < width; i++) {
                let f = i / width;
                frequencyHz[i] = nyquist * Math.pow(2, noctaves * (f - 1));
                magResponse[i] = 1;
            }

            // multiplier les réponses de tous les filtres
            filters.forEach(filter => {
                const tmpMag = new Float32Array(width);
                filter.getFrequencyResponse(frequencyHz, tmpMag, phaseResponse);
                for (let i = 0; i < width; i++) {
                    magResponse[i] *= tmpMag[i];
                }
            });

            // grille
            drawGrid(nyquist, noctaves);

            // courbe finale
            ctx.beginPath();
            ctx.strokeStyle = curveColor;
            ctx.lineWidth = 3;

            for (let i = 0; i < width; i++) {
                const db = 20 * Math.log10(magResponse[i]);
                const x = i;
                const y = dbToY(db);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }

            ctx.stroke();
        }

        return { draw };
    }

}
customElements.define('my-audio-player', MyAudioPlayer);