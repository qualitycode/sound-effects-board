const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadPads: () => ipcRenderer.invoke('pads:load'),
  savePads: (pads) => ipcRenderer.invoke('pads:save', pads),
  pickMedia: (kind) => ipcRenderer.invoke('media:pick', kind),
  showDataFolder: () => ipcRenderer.invoke('app:showDataFolder'),
});
