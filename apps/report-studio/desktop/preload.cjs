// What the studio page may ask of the desktop app: only sign-in (the token comes back; nothing else is exposed).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reportStudioDesktop', {
  relayUrl: 'claude-relay://api',
  signIn: (params) => ipcRenderer.invoke('studio:sign-in', params),
});
