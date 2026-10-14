/**
 * Esteshari Desktop (Windows)
 * © All rights reserved. Nexus Solutions
 *
 * v2.1 – adds automatic updates and native PDF export.
 */
const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
let mainWindow = null;

/* ---------------------------------------------------------------
 *  Update feed – one file, one place to fill.
 *  update.config.json holds your hosting / GitHub details.
 * --------------------------------------------------------------- */
let updateFeedUrl = '';
function loadUpdateConfig() {
  try {
    const cfg = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', 'update.config.json'), 'utf8'));
    if (cfg.owner && cfg.owner.indexOf('YOUR-') === -1) {
      updateFeedUrl = { provider: 'github', owner: cfg.owner, repo: cfg.repo || 'esteshari' };
    } else if (cfg.url && cfg.url.indexOf('YOUR-SERVER') === -1) {
      updateFeedUrl = { provider: 'generic', url: cfg.url };
    }
  } catch (e) {
    console.warn('[update] update.config.json not found or invalid:', e.message);
  }
}

/* ---------------------------------------------------------------
 *  Auto update (electron-updater)
 *  Works only on a packaged build (npm run pack:win).
 *  The feed comes from update.config.json – fill one file only.
 * --------------------------------------------------------------- */
let autoUpdater = null;

function getAutoUpdater() {
  if (autoUpdater) return autoUpdater;
  try {
    const { autoUpdater: au } = require('electron-updater');
    return au;
  } catch (e) {
    console.warn('electron-updater is not installed:', e.message);
    return null;
  }
}

function sendUpdate(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', state);
  }
}

function setupAutoUpdater() {
  loadUpdateConfig();
  if (updateFeedUrl) {
    try {
      const { autoUpdater: au } = require('electron-updater');
      const api = au && au.autoUpdater ? au.autoUpdater : au;
      if (api && typeof api.setFeedURL === 'function') api.setFeedURL(updateFeedUrl);
    } catch (e) {
      console.warn('[update] setFeedURL failed:', e.message);
    }
  }
  const au = getAutoUpdater();
  autoUpdater = au;
  if (!au) return;

  if (isDev) {
    console.log('[update] skipped: running unpacked (npm run desktop)');
    return;
  }

  try {
    au.autoDownload = false;   // ask the engineer first, then download
    au.autoInstallOnAppQuit = true;
    au.logger = null;

    au.on('checking-for-update', () => sendUpdate({ state: 'checking' }));

    au.on('update-available', (info) => {
      sendUpdate({ state: 'available', version: info?.version, notes: info?.releaseNotes || '' });
    });

    au.on('update-not-available', () => sendUpdate({ state: 'up-to-date' }));

    au.on('download-progress', (p) => {
      sendUpdate({ state: 'downloading', percent: Math.round(p?.percent || 0) });
    });

    au.on('update-downloaded', (info) => {
      sendUpdate({ state: 'downloaded', version: info?.version });
    });

    au.on('error', (err) => {
      sendUpdate({ state: 'error', error: err?.message || String(err) });
    });
  } catch (e) {
    console.warn('[update] setup failed:', e.message);
  }
}

function checkForUpdates() {
  const au = getAutoUpdater();
  if (!au) return { ok: false, error: 'electron-updater is not installed' };
  if (isDev) return { ok: false, dev: true, error: 'Updates are only checked in a packaged build' };
  au.checkForUpdates().catch((e) => sendUpdate({ state: 'error', error: e.message }));
  return { ok: true };
}

/* ---------------------------------------------------------------
 *  Window
 * --------------------------------------------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Esteshari – MEP Document Portal',
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ---------------------------------------------------------------
 *  Application menu (adds a Help → Check for updates entry)
 * --------------------------------------------------------------- */
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for Updates…', click: () => checkForUpdates() },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------------------------------------------------------
 *  IPC
 * --------------------------------------------------------------- */
ipcMain.on('app:version', (e) => { e.returnValue = app.getVersion(); });

ipcMain.handle('update:check', () => checkForUpdates());

ipcMain.handle('update:download', () => {
  const au = getAutoUpdater();
  if (!au) return { ok: false, error: 'electron-updater is not installed' };
  au.downloadUpdate().catch((e) => sendUpdate({ state: 'error', error: e.message }));
  return { ok: true };
});

ipcMain.handle('update:install', () => {
  const au = getAutoUpdater();
  if (au && au.isDownloaded) au.quitAndInstall(false, true);
  else app.relaunch(), app.quit();
  return { ok: true };
});

/* native PDF export: renders the report HTML and saves it with a save dialog */
ipcMain.handle('pdf:export', async (_e, { html, fileName }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF',
      defaultPath: fileName || 'Esteshari.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true, javascript: false, nodeIntegration: false, contextIsolation: true }
    });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html || '<p>Nothing to export</p>'));
    const data = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'none' }
    });
    win.destroy();
    require('fs').writeFileSync(filePath, data);
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ---------------------------------------------------------------
 *  Boot
 * --------------------------------------------------------------- */
app.whenReady().then(() => {
  buildMenu();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});