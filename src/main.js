const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DATA_DIR = path.join(app.getPath('userData'), 'melodix-data');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const AUDIO_EXT = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac'];
const VIDEO_EXT = ['.mp4'];
const SUPPORTED_EXT = [...AUDIO_EXT, ...VIDEO_EXT];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#15110f',
    icon: path.join(__dirname, '../build/favicon.ico'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.on('maximize', () => win.webContents.send('window-maximized-state', true));
  win.on('unmaximize', () => win.webContents.send('window-maximized-state', false));

  return win;
}

// ---------- Window controls (custom titlebar) ----------

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
});

app.whenReady().then(() => {
  ensureDataDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Persistence ----------

ipcMain.handle('load-library', () => {
  ensureDataDir();
  if (!fs.existsSync(LIBRARY_FILE)) {
    return { tracks: [], playlists: [] };
  }
  try {
    const raw = fs.readFileSync(LIBRARY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { tracks: [], playlists: [] };
  }
});

ipcMain.handle('save-library', (event, data) => {
  ensureDataDir();
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

// ---------- Folder picker ----------

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return collectAudioFiles(result.filePaths[0]);
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Media', extensions: SUPPORTED_EXT.map(e => e.slice(1)) }]
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

function collectAudioFiles(dirPath) {
  let results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(collectAudioFiles(fullPath));
    } else if (SUPPORTED_EXT.includes(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

// Expand dropped paths (files or folders) into a flat list of audio file paths
ipcMain.handle('expand-paths', (event, paths) => {
  let results = [];
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        results = results.concat(collectAudioFiles(p));
      } else if (SUPPORTED_EXT.includes(path.extname(p).toLowerCase())) {
        results.push(p);
      }
    } catch (e) {
      // ignore unreadable path
    }
  }
  return results;
});

// ---------- Metadata extraction ----------

ipcMain.handle('read-metadata', async (event, filePaths) => {
  const mm = await import('music-metadata');
  const out = [];
  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXT.includes(ext)) {
      out.push({
        path: filePath,
        title: path.basename(filePath, path.extname(filePath)),
        artist: '',
        album: '',
        duration: 0,
        cover: null,
        type: 'video'
      });
      continue;
    }
    try {
      const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
      const common = metadata.common || {};
      const format = metadata.format || {};
      let cover = null;
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        const base64 = Buffer.from(pic.data).toString('base64');
        cover = `data:${pic.format};base64,${base64}`;
      }
      out.push({
        path: filePath,
        title: common.title || path.basename(filePath, path.extname(filePath)),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Unknown Album',
        duration: format.duration || 0,
        cover,
        type: 'audio'
      });
    } catch (e) {
      out.push({
        path: filePath,
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        cover: null,
        type: 'audio'
      });
    }
  }
  return out;
});

ipcMain.handle('file-exists', (event, filePath) => {
  return fs.existsSync(filePath);
});
