// What the studio page may ask of the desktop app: sign-in (the token comes back), the File menu's commands
// (new | open | save | saveAs, sent by main.cjs), and telling its tab's state and save results; nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reportStudioDesktop', {
  relayUrl: 'claude-relay://api',
  signIn: (params) => ipcRenderer.invoke('studio:sign-in', params),
  onMenu: (handler) => {
    const listener = (_event, action) => handler(action);
    ipcRenderer.on('studio:menu', listener);
    return () => ipcRenderer.removeListener('studio:menu', listener);
  },
  /** The tab strip shows this: { title, running, dirty, empty }. */
  setTabState: (state) => ipcRenderer.send('studio:tab-state', state),
  /** Answers a save the app asked for (closing a tab with unsaved changes). */
  saveResult: (ok) => ipcRenderer.send('studio:save-result', ok),
});
