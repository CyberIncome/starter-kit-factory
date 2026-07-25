const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kitFactory', {
  generateKit: (payload) => ipcRenderer.invoke('kit:generate', payload),
  getRecentOrders: () => ipcRenderer.invoke('orders:list'),
  openFolder: (folder) => ipcRenderer.invoke('shell:open-folder', folder),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:choose-folder'),
  getAppInfo: () => ipcRenderer.invoke('app:info')
});
