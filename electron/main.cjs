const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { autoUpdater } = require('electron-updater');
const { generateStarterKit } = require('./starter-kit.cjs');
const { readOrders, saveOrder } = require('./orders.cjs');
const { runCli } = require('./cli.cjs');
const { createPdfRenderer } = require('./pdf-renderer.cjs');

let mainWindow;
const cliIndex = process.argv.indexOf('--cli');
const cliMode = cliIndex !== -1;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 930,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0b1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d151c', symbolColor: '#dce6ea', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

function configureUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async (info) => {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Install now', 'Later'],
      defaultId: 0,
      title: 'Starter Kit Factory update ready',
      message: `Version ${info.version} is ready to install.`,
      detail: 'The update will keep your local orders and generated kits.'
    });
    if (response.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  if (cliMode) {
    runCli({ app, BrowserWindow, args: process.argv.slice(cliIndex + 1) })
      .then((code) => app.exit(code))
      .catch((error) => { console.error(JSON.stringify({ status: 'error', message: error.message })); app.exit(1); });
    return;
  }
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('orders:list', () => readOrders(app.getPath('userData')));
  ipcMain.handle('shell:open-folder', async (_event, folder) => {
    const target = folder || path.join(app.getPath('documents'), 'Starter Kit Factory', 'Generated Kits');
    await fs.mkdir(target, { recursive: true });
    return shell.openPath(target);
  });
  ipcMain.handle('backup:choose-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('kit:generate', async (_event, payload) => {
    const outputRoot = path.join(app.getPath('documents'), 'Starter Kit Factory', 'Generated Kits');
    const result = await generateStarterKit({
      payload,
      outputRoot,
      renderPdf: createPdfRenderer(BrowserWindow)
    });
    await saveOrder(app.getPath('userData'), {
      id: payload.orderNumber || `${Date.now()}`,
      businessName: payload.businessName,
      industry: payload.industry,
      theme: payload.theme,
      createdAt: new Date().toISOString(),
      outputFolder: result.folder,
      zipPath: result.zipPath,
      status: 'Ready to deliver'
    });
    return result;
  });
  createWindow();
  configureUpdates();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (!cliMode && process.platform !== 'darwin') app.quit(); });
