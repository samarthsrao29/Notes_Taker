import { globalShortcut, BrowserWindow, Notification } from 'electron'
import { processCapture } from './capture'
import { dbOps } from './database'
import { runSyncCycle } from './sync'

export interface ShortcutConfig {
  h1: string
  h2: string
  h3: string
  paragraph: string
  bullet: string
  quote: string
  definition: string
  important: string
  checklist: string
  aiSummary: string
  aiExplain: string
  aiFlashcards: string
  addTags: string
}

// Default keyboard shortcuts
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  h1: 'CommandOrControl+T',
  h2: 'CommandOrControl+Shift+T',
  h3: 'CommandOrControl+Shift+3',
  paragraph: 'CommandOrControl+N',
  bullet: 'CommandOrControl+B',
  quote: 'CommandOrControl+Q',
  definition: 'CommandOrControl+D',
  important: 'CommandOrControl+I',
  checklist: 'CommandOrControl+L',
  aiSummary: 'CommandOrControl+S',
  aiExplain: 'CommandOrControl+E',
  aiFlashcards: 'CommandOrControl+F',
  addTags: 'CommandOrControl+M'
}

let activeWindow: BrowserWindow | null = null

function showNativeNotification(success: boolean, message: string): void {
  if (Notification.isSupported()) {
    new Notification({
      title: success ? 'Note Captured' : 'Capture Failed',
      body: message,
      silent: true
    }).show()
  }
}

export function registerAllShortcuts(window: BrowserWindow | null): void {
  activeWindow = window
  
  // Unregister first to prevent duplicate registration issues
  unregisterAllShortcuts()

  // Do not register shortcuts if capturing is disabled globally
  const isActive = dbOps.getSetting<boolean>('capture_active', true)
  if (!isActive) return
  
  // Load shortcuts from DB settings, or use defaults
  const shortcuts = dbOps.getSetting<ShortcutConfig>('shortcuts_config', DEFAULT_SHORTCUTS)

  // Mapping configurations to actions
  const mappings: { key: keyof ShortcutConfig; format: any; isAI?: boolean; aiType?: string }[] = [
    { key: 'h1', format: 'h1' },
    { key: 'h2', format: 'h2' },
    { key: 'h3', format: 'h3' },
    { key: 'paragraph', format: 'paragraph' },
    { key: 'bullet', format: 'bullet' },
    { key: 'quote', format: 'quote' },
    { key: 'definition', format: 'definition' },
    { key: 'important', format: 'important' },
    { key: 'checklist', format: 'checklist' },
    { key: 'aiSummary', format: 'paragraph', isAI: true, aiType: 'summary' },
    { key: 'aiExplain', format: 'paragraph', isAI: true, aiType: 'explain' },
    { key: 'aiFlashcards', format: 'paragraph', isAI: true, aiType: 'flashcards' },
    { key: 'addTags', format: 'paragraph', isAI: true, aiType: 'autotags' }
  ]

  for (const map of mappings) {
    if (map.isAI) continue // Temporarily disable all AI features/hotkeys

    const accelerator = shortcuts[map.key]
    if (!accelerator) continue

    try {
      const isRegistered = globalShortcut.register(accelerator, async () => {
        // Capture global in a local constant for safe TypeScript type narrowing
        const win = activeWindow
        const isWindowValid = win && !win.isDestroyed()
        if (isWindowValid) {
          win.webContents.send('capture-started')
        }

        if (map.isAI) {
          if (isWindowValid) {
            win.webContents.send('trigger-ai-capture', { type: map.aiType })
          }
        } else {
          const result = await processCapture(map.format)
          if (result.success && result.note) {
            runSyncCycle().catch((err) => console.error('Failed immediate sync:', err))
            if (isWindowValid) {
              // Notify UI to refresh and display toast
              win.webContents.send('note-captured', {
                success: true,
                message: result.message,
                note: result.note
              })
            } else {
              showNativeNotification(true, result.message)
            }
          } else {
            if (isWindowValid) {
              win.webContents.send('note-captured', {
                success: false,
                message: result.message
              })
            } else {
              showNativeNotification(false, result.message)
            }
          }
        }
      })

      if (!isRegistered) {
        console.error(`Failed to register global shortcut: ${accelerator}`)
      }
    } catch (err) {
      console.error(`Error registering shortcut: ${accelerator}`, err)
    }
  }

  // 1. Always register Alt+S / Alt+N for same-line / next-line capture
  const alwaysShortcuts = [
    { accelerator: 'Alt+S', format: 'same-line' },
    { accelerator: 'Alt+N', format: 'next-line' }
  ]

  for (const s of alwaysShortcuts) {
    try {
      globalShortcut.register(s.accelerator, async () => {
        const win = activeWindow
        const isWindowValid = win && !win.isDestroyed()
        if (isWindowValid) {
          win.webContents.send('capture-started')
        }
        const result = await processCapture(s.format as any)
        if (result.success) {
          runSyncCycle().catch((err) => console.error('Failed immediate sync:', err))
        }
        if (isWindowValid) {
          win.webContents.send('note-captured', result)
        } else {
          showNativeNotification(result.success, result.message)
        }
      })
    } catch (err) {
      console.error(`Failed to register Alt shortcut ${s.accelerator}:`, err)
    }
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
}

export function rebindShortcuts(window: BrowserWindow | null): void {
  unregisterAllShortcuts()
  registerAllShortcuts(window)
}
