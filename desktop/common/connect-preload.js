const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kevcast', {
  info: () => ipcRenderer.invoke('connect:info'),
  discover: () => ipcRenderer.invoke('connect:discover'),
  connect: (url) => ipcRenderer.invoke('connect:connect', url),
  cancel: () => ipcRenderer.invoke('connect:cancel'),
});
