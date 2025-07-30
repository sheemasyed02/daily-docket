const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
const fs = require('fs'); // Add this for debugging
 
let mainWindow;

function createWindow() {
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'Cache'));
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

  // DEBUG: Check icon file
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  console.log('=== ICON DEBUG INFO ===');
  console.log('Current directory (__dirname):', __dirname);
  console.log('Full icon path:', iconPath);
  console.log('Icon file exists:', fs.existsSync(iconPath));
  
  if (fs.existsSync(iconPath)) {
    const stats = fs.statSync(iconPath);
    console.log('Icon file size:', stats.size, 'bytes');
    console.log('Icon file modified:', stats.mtime);
  } else {
    console.error('❌ Icon file NOT FOUND!');
    // List what's actually in the assets folder
    const assetsPath = path.join(__dirname, 'assets');
    if (fs.existsSync(assetsPath)) {
      console.log('Files in assets folder:', fs.readdirSync(assetsPath));
    } else {
      console.error('❌ Assets folder does not exist!');
    }
  }
  console.log('======================');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath, // Use the variable for consistency
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Try alternative method after window creation
  if (fs.existsSync(iconPath)) {
    try {
      mainWindow.setIcon(iconPath);
      console.log('✅ Icon set successfully using setIcon()');
    } catch (error) {
      console.error('❌ Error setting icon:', error.message);
    }
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window shown');
  });

  // Development tools
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for notifications
ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets/icon.png')
    });
    notification.show();
    return true;
  }
  return false;
});

// Menu setup
const template = [
  {
    label: 'File',
    submenu: [
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
