// Exposes a small, safe API to the web player (public/player/player.js looks for `kevcastNative`).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kevcastNative', {
  /** JPEG bytes of what is currently on screen. */
  captureScreenshot: () => ipcRenderer.invoke('player:screenshot'),
  /** Provisioning info from a deployed player.json (auto-approval), or null. */
  provisioning: () => ipcRenderer.invoke('player:provisioning'),
  info: () => ipcRenderer.invoke('player:info'),
  retry: () => ipcRenderer.send('player:retry'),
  changeServer: () => ipcRenderer.send('player:change-server'),
});
