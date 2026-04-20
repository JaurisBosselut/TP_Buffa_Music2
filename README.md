# TP Buffa Music 2

Projet Web Components pour un lecteur audio modulaire.

## Lancer le projet

Comme le projet utilise des modules JavaScript (`type="module"`), il faut le lancer avec un serveur local HTTP (pas en ouvrant directement le fichier `index.html`).

### Option 1 - Python

Dans le dossier du projet, lance :

```bash
python -m http.server 8000
```

Puis ouvre dans le navigateur :

`http://localhost:8000`

### Option 2 - Live Server (VS Code / Cursor)

- Clique droit sur `index.html`
- Choisis **Open with Live Server**

## Utilisation

- La page charge le composant principal `audio-player`.
- Tu peux ajouter des composants locaux via le bouton **Ajouter Web Component**.
- Tu peux aussi ajouter des composants externes (d'autres élèves) via :
  - URL du fichier `.js`
  - Tag saisi
  - Bouton **Ajouter composant externe**

## Exemple de composant externe (playlist)

Exemple avec la playlist :

- URL : `https://catiavarela.github.io/Components/Playlist/playlist.js`
- Tag saisi (exemple) : `playlist-autre`

Important :

- Le composant ci-dessus déclare en réalité le tag `playlist-autre`.
- Le projet détecte automatiquement le tag réel déclaré dans le module.

Référence du composant playlist :
- [playlist.js](https://catiavarela.github.io/Components/Playlist/playlist.js)

## Remarques

- Un tag de Web Component doit contenir un tiret (`-`), par exemple `my-playlist`.
- Chaque composant doit avoir un tag unique pour éviter les conflits.
