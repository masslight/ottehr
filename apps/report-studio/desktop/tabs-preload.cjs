// What the tab strip (tabs.html) may ask of the desktop app: the open tabs and their state, and switching,
// closing or adding one. main.cjs owns the tabs.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabsHost', {
  platform: process.platform,
  onState: (handler) => ipcRenderer.on('tabs:state', (_event, state) => handler(state)),
  activate: (id) => ipcRenderer.send('tabs:activate', id),
  close: (id) => ipcRenderer.send('tabs:close', id),
  add: () => ipcRenderer.send('tabs:add'),
});
