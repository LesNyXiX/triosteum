// Мост между страницей и приложением: только выбор режима, без доступа к файлам и системе.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('triosteumDesktop', {
  platform: process.platform,
  settings: () => ipcRenderer.invoke('desktop:settings'),
  choose: (mode, server, remember) => ipcRenderer.invoke('desktop:choose', { mode, server, remember }),
  switchMode: () => ipcRenderer.send('desktop:switch')
});
