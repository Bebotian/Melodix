const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('melodix', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  expandPaths: (paths) => ipcRenderer.invoke('expand-paths', paths),
  readMetadata: (paths) => ipcRenderer.invoke('read-metadata', paths),
  loadLibrary: () => ipcRenderer.invoke('load-library'),
  saveLibrary: (data) => ipcRenderer.invoke('save-library', data),
  fileExists: (p) => ipcRenderer.invoke('file-exists', p),
  // Resolves an absolute filesystem path from a File object dropped onto the window
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      return file.path || null;
    }
  },
  toFileUrl: (p) => 'file://' + encodeURI(p.replace(/\\/g, '/')),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximizedState: (callback) => ipcRenderer.on('window-maximized-state', (event, isMaximized) => callback(isMaximized))
});
