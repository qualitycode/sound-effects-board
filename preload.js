const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadScript: () => ipcRenderer.invoke('script:load'),
  saveScript: (assignments) => ipcRenderer.invoke('script:save', assignments),
  onScriptReplaced: (callback) => ipcRenderer.on('script:replaced', callback),
  loadPads: () => ipcRenderer.invoke('pads:load'),
  savePads: (pads) => ipcRenderer.invoke('pads:save', pads),
  pickMedia: (kind) => ipcRenderer.invoke('media:pick', kind),
  saveRecording: (wav) => ipcRenderer.invoke('media:saveRecording', wav),
  requestMic: () => ipcRenderer.invoke('mic:request'),
  onPadsReplaced: (callback) => ipcRenderer.on('pads:replaced', (_e, pads) => callback(pads)),
  showDataFolder: () => ipcRenderer.invoke('app:showDataFolder'),
});
