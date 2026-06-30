# Melodix

A real desktop music player (built with Electron — not a website). It has:

- **Library** — every imported song in one place, with cover art, title, artist, album and duration
- **Playlists** — create as many as you like, right-click any song to add/remove it from one
- **Drag & drop import** — drop MP3/M4A/FLAC/WAV/OGG files or whole folders anywhere on the window to add them to your library (or use the dedicated "Add Music" drop zone)
- **Cover art** — read automatically from each file's embedded tags and shown in the track list and on the spinning vinyl in the player bar
- **A real player bar** — play/pause, next/previous, seek, volume, shuffle, repeat

Your library and playlists are saved locally on your machine, so everything is still there next time you open the app.

## Running it on your computer

You need [Node.js](https://nodejs.org) installed (this also gives you `npm`).

```bash
cd melodix
npm install
npm start
```

That opens Melodix as its own window — a real desktop app, no browser involved.

## Building an installer (.exe / .dmg / .AppImage)

If you want a double-click installer to share or keep in your Applications/Start menu:

```bash
npm install
npm run dist
```

This uses `electron-builder` and writes the installer into the `release/` folder:
- Windows → `.exe` (NSIS installer)
- macOS → `.dmg`
- Linux → `.AppImage`

Build on the OS you want to target (e.g. build the `.dmg` on a Mac, the `.exe` on Windows) for best results.

## Using it

1. Open the app and go to **Add Music** in the sidebar.
2. Drag your downloaded song files (or a whole folder of them) onto the drop zone, or click **Choose Files** / **Choose Folder**.
3. Melodix reads each file's tags (title, artist, album, cover art) automatically and adds it to your **Library**.
4. Click **+** next to **Playlists** to create a playlist, then right-click any song → **Add to Playlist**.
5. Click a song to play it; use the player bar at the bottom to control playback.

## Project structure

```
melodix/
  package.json
  src/
    main.js       — Electron main process (window, file system, tag reading)
    preload.js    — secure bridge between the app window and the OS
    index.html    — app layout
    styles.css    — visual design
    renderer.js   — UI logic, playback, library & playlist management
```

## Notes

- Supported formats: MP3, M4A, FLAC, WAV, OGG, AAC.
- Importing doesn't move or copy your files — Melodix just remembers where they are on disk, so keep your downloaded songs somewhere you won't delete them.
- If a file's tags don't include a cover image, a placeholder icon is shown instead.
