const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { autoUpdater } = require('electron-updater');
const { generateStarterKit, safeFolderName } = require('./starter-kit.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 930,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#f4f1e9',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#17322b', symbolColor: '#f4f1e9', height: 36 },
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

function ordersFile() { return path.join(app.getPath('userData'), 'orders.json'); }

async function readOrders() {
  try { return JSON.parse(await fs.readFile(ordersFile(), 'utf8')); }
  catch { return []; }
}

async function saveOrder(order) {
  const kept = (await readOrders()).filter((item) => item.id !== order.id);
  kept.unshift(order);
  await fs.writeFile(ordersFile(), JSON.stringify(kept.slice(0, 100), null, 2));
}

app.whenReady().then(() => {
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('orders:list', readOrders);
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
      renderPdf: async (html, outputFile, pageSize) => {
        const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        try {
          await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
          const pdf = await printWindow.webContents.printToPDF({
            printBackground: true,
            pageSize,
            preferCSSPageSize: true,
            margins: { marginType: 'none' }
          });
          await fs.writeFile(outputFile, pdf);
        } finally { printWindow.destroy(); }
      }
    });
    await saveOrder({
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
