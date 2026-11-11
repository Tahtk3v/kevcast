// Gives the Web Studio page inside KevCast Studio access to the files on this computer.
// The page checks for `window.kevcastStudio` and shows a "This computer" panel when present.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('kevcastStudio', {
  /** Quick folders (Desktop, Documents, Downloads, OneDrive, drives…), recent folders and the last folder used. */
  places: () => ipcRenderer.invoke('studio:places'),
  /** Folders and supported files (PowerPoint, PDF, images, videos) in a folder. */
  list: (dir) => ipcRenderer.invoke('studio:list', dir),
  /** The system's file dialog; resolves to the chosen files. */
  pickFiles: () => ipcRenderer.invoke('studio:pick-files'),
  pickFolder: () => ipcRenderer.invoke('studio:pick-folder'),
  rememberFolder: (dir) => ipcRenderer.invoke('studio:remember-folder', dir),
  reveal: (p) => ipcRenderer.invoke('studio:reveal', p),
  /** Upload files by path; progress arrives through onUploadProgress. Resolves to the created media items.
   *  opts: { powerpoint, replaceFonts, fontReplacements } — convert PowerPoint files with this computer's PowerPoint first. */
  upload: (paths, opts) => ipcRenderer.invoke('studio:upload', paths, opts || {}),
  /** What this computer can do: { powerpoint } (Microsoft PowerPoint installed, Windows). */
  capabilities: () => ipcRenderer.invoke('studio:capabilities'),
  /** The path on disk of a dragged-in file, so drops are uploaded by the app too. */
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch { return ''; } },
  onUploadProgress: (fn) => {
    const listener = (e, p) => fn(p);
    ipcRenderer.on('studio:upload-progress', listener);
    return () => ipcRenderer.removeListener('studio:upload-progress', listener);
  },
});
