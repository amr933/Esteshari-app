/**
 * Esteshari Desktop – preload bridge
 * © All rights reserved. Nexus Solutions
 *
 * Gives the renderer page access to the updater and to the PDF writer.
 * The page runs with contextIsolation on, so everything must be exposed
 * explicitly here – nothing else from Node leaks into the app.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('esteshari', {
  isDesktop: true,
  version: () => ipcRenderer.sendSync('app:version'),

  /* --- auto update --- */
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },

  /* --- PDF export --- */
  exportPdf: (html, fileName) => ipcRenderer.invoke('pdf:export', { html, fileName })
});