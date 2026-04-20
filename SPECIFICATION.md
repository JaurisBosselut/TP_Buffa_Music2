# SPECIFICATION — Web Components Audio

Ce document décrit l’API publique des composants (attributs HTML, propriétés JS, méthodes, événements).

## Convention d’événements

- **Commandes** (enfants → hôte): `audio:cmd:*`
- **États** (hôte → enfants): `audio:*`
- Tous les événements “commande” sont émis avec:
  - `bubbles: true`
  - `composed: true`

## 1) `<audio-player>`

Composant hôte. Possède l’unique `AudioContext` et le graphe Web Audio.

### Attributs HTML

- **`src`**: URL de la piste à charger (ex: `Pokemon.mp3`)
- **`volume`**: volume \(0..1\)
- **`muted`**: booléen (présence de l’attribut = true)
- **`autoplay`**: booléen (présence de l’attribut = true)

### Propriétés (JS)

- **`src: string`**
- **`volume: number`** \(0..1\)
- **`muted: boolean`**
- **`autoplay: boolean`**
- **`currentTime: number`** (secondes)
- **`duration: number`** (secondes, 0 si inconnue)
- **`paused: boolean`**
- **`audioContext: AudioContext | null`** (read-only)

### Méthodes publiques

- **`load(url: string, options?: { autoplay?: boolean }): Promise<void>`**
- **`play(): Promise<void>`**
- **`pause(): void`**
- **`toggle(): Promise<void>`**
- **`seek(timeSeconds: number): void`**
- **`setEqBands(bands: Array<{ f: number, q?: number, gain?: number }>): void`**
- **`getEqBands(): Array<{ f: number, q: number, gain: number }>`**

### Événements émis

- **`audio:ready`** `{ sampleRate?: number }`
- **`audio:state`** `{ paused, muted, volume, src, currentTime, duration }`
- **`audio:track`** `{ url, title, duration }`
- **`audio:time`** `{ currentTime, duration }`
- **`audio:eq`** `{ bands }`
- **`audio:ended`** `{ src }`
- **`audio:error`** `{ message }`

### Événements consommés (commandes)

- **`audio:cmd:play`**
- **`audio:cmd:pause`**
- **`audio:cmd:toggle`**
- **`audio:cmd:seek`** `{ time }`
- **`audio:cmd:setVolume`** `{ value }`
- **`audio:cmd:setMuted`** `{ value }`
- **`audio:cmd:selectTrack`** `{ url, title?, autoplay? }`
- **`audio:cmd:setEq`** `{ bands }`
- **`audio:cmd:subscribeFrequency`** `{ target, fftSize?, minDb?, maxDb?, smoothing? }`
- **`audio:cmd:unsubscribeFrequency`** `{ target }`

## 2) `<audio-playlist>`

Sélecteur de piste. Émet une commande de sélection de piste vers l’hôte.

### Attributs HTML

- **`src`**: URL d’un JSON de playlist (optionnel)
- **`autoplay`**: si présent, demande à jouer immédiatement après sélection
- **`selected`**: URL de la piste sélectionnée (optionnel)

### Propriétés (JS)

- **`src: string`**
- **`autoplay: boolean`**
- **`items: Array<{ title: string, url: string }>`**
- **`selected: string`**

### Méthodes publiques

- **`load(url: string): Promise<void>`**
- **`selectByIndex(index: number, options?: { autoplay?: boolean }): void`**

### Événements émis

- **`audio:cmd:selectTrack`** `{ url, title, autoplay }`

### Événements consommés

- **`audio:track`** `{ url, ... }` (utilisé pour refléter la piste en cours si l’URL correspond)

## 3) `<audio-eq>`

UI d’égaliseur “6 bandes” (configurable). Émet l’état des bandes à l’hôte.

### Attributs HTML

- **`frequencies`**: liste CSV, ex: `"60,170,350,1000,3500,10000"`
- **`min-gain`**: gain min en dB (défaut `-12`)
- **`max-gain`**: gain max en dB (défaut `12`)
- **`step`**: pas des sliders (défaut `0.5`)

### Propriétés (JS)

- **`frequencies: number[]`**
- **`bands: Array<{ f: number, q: number, gain: number }>`**
- **`minGain: number`**
- **`maxGain: number`**

### Méthodes publiques

- **`reset(): void`** (remet tous les gains à 0 dB)

### Événements émis

- **`audio:cmd:setEq`** `{ bands }`

### Événements consommés

- **`audio:eq`** `{ bands }` (permet de synchroniser l’UI si l’hôte renvoie un état)

## 4) `<audio-visualizer-frequency>`

Visualiseur FFT sur `<canvas>`. S’abonne à l’hôte via événements, puis reçoit les bins de fréquence.

### Attributs HTML

- **`fft-size`**: taille FFT souhaitée (ex: `2048`)
- **`min-db`**: min decibels pour l’`AnalyserNode`
- **`max-db`**: max decibels pour l’`AnalyserNode`
- **`smoothing`**: smoothingTimeConstant \(0..1\)
- **`bar-color`**: couleur des barres
- **`bg-color`**: couleur de fond

### Propriétés (JS)

- **`fftSize: number`**
- **`minDb: number`**
- **`maxDb: number`**
- **`smoothing: number`**

### Méthodes publiques

- **`start(): void`**
- **`stop(): void`**

### Événements émis

- **`audio:cmd:subscribeFrequency`** `{ target, fftSize, minDb, maxDb, smoothing }`
- **`audio:cmd:unsubscribeFrequency`** `{ target }`

### Événements consommés

- **`audio:frequency`** `{ data: Uint8Array, sampleRate: number | null }`
  - Cet événement est dispatché par l’hôte **directement sur l’élément visualiseur** (ciblage), pour éviter les problèmes de propagation entre siblings.

## Notes d’intégration (important)

- Pour que la communication “enfants → hôte” fonctionne, les composants qui envoient des commandes doivent être **dans** le DOM descendant de `<audio-player>` (événements qui remontent).
- Démo: `demo/index.html`.

