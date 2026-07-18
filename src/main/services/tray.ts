import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { dbOps } from './database'
import { registerAllShortcuts, unregisterAllShortcuts } from './shortcuts'
import { startSyncService, stopSyncService } from './sync'
import trayIconPath from '../../../resources/trayTemplate.svg?asset'

let tray: Tray | null = null
let createWindowFn: (() => void) | null = null

export function createTray(createWin: () => void): Tray {
  if (tray) return tray

  createWindowFn = createWin

  // Load the SVG icon as a nativeImage
  const image = nativeImage.createFromPath(trayIconPath)
  image.setTemplateImage(true)

  tray = new Tray(image)
  tray.setToolTip('Smart Notes')

  updateTrayMenu()

  return tray
}

export function updateTrayMenu(): void {
  if (!tray) return

  const isActive = dbOps.getSetting<boolean>('capture_active', true)
  const openAtLogin = app.getLoginItemSettings().openAtLogin

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Smart Notes',
      enabled: false
    },
    {
      label: `Capture Status: ${isActive ? 'Active (ON)' : 'Disabled (OFF)'}`,
      enabled: false
    },
    {
      label: 'Toggle Capture Active',
      type: 'checkbox',
      checked: isActive,
      click: () => {
        const nextActive = !isActive
        dbOps.setSetting('capture_active', nextActive)

        // Find the active window to rebind shortcuts if needed
        const windows = BrowserWindow.getAllWindows()
        const win = windows.length > 0 ? windows[0] : null

        if (nextActive) {
          registerAllShortcuts(win)
          startSyncService()
        } else {
          unregisterAllShortcuts()
          stopSyncService()
        }

        // Notify renderer that the capture active status changed
        if (win && !win.isDestroyed()) {
          win.webContents.send('capture-active-changed', nextActive)
        }

        // Rebuild tray menu
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Show App Window',
      click: () => {
        const windows = BrowserWindow.getAllWindows()
        if (windows.length > 0) {
          const win = windows[0]
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        } else if (createWindowFn) {
          createWindowFn()
        }
      }
    },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: openAtLogin,
      click: () => {
        const nextOpenAtLogin = !openAtLogin
        app.setLoginItemSettings({
          openAtLogin: nextOpenAtLogin,
          openAsHidden: true
        })
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Smart Notes',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}
