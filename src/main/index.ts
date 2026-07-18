import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Import services and helpers
import { initDb, dbOps } from './services/database'
import { registerIpcHandlers } from './ipc'
import { registerAllShortcuts, unregisterAllShortcuts } from './services/shortcuts'
import { startSyncService, stopSyncService } from './services/sync'
import { createTray } from './services/tray'

function createWindow(): void {
  // If on macOS, show the Dock icon when the window is opened
  if (app.dock) {
    app.dock.show()
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Hide the Dock icon when the window is closed on macOS (keeps app in Tray only)
  mainWindow.on('closed', () => {
    if (app.dock && BrowserWindow.getAllWindows().length === 0) {
      app.dock.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Register IPC handlers for this window
  registerIpcHandlers(mainWindow)

  // Register global shortcuts if capture is active
  const isActive = dbOps.getSetting<boolean>('capture_active', true)
  if (isActive) {
    registerAllShortcuts(mainWindow)
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize local SQLite database
  initDb()

  // Create system tray icon in the macOS menu bar
  createTray(createWindow)

  // Start background sync polling service if active
  const isActive = dbOps.getSetting<boolean>('capture_active', true)
  if (isActive) {
    startSyncService()
    registerAllShortcuts(null)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Check login settings: start silent in Tray if opened at login
  const loginSettings = app.getLoginItemSettings()
  const wasOpenedAsHidden = loginSettings.wasOpenedAsHidden || false
  const wasOpenedAtLogin = loginSettings.wasOpenedAtLogin || false

  if (!wasOpenedAsHidden && !wasOpenedAtLogin) {
    createWindow()
  } else if (app.dock) {
    app.dock.hide()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    unregisterAllShortcuts()
    stopSyncService()
    app.quit()
  }
})

app.on('will-quit', () => {
  // Ensure keyboard shortcuts and interval tasks are cleaned up
  unregisterAllShortcuts()
  stopSyncService()
})

