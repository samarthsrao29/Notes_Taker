import { exec } from 'child_process'
import { clipboard } from 'electron'
import { dbOps } from './database'

export interface CapturedSelection {
  text: string
  sourceType: 'browser' | 'app' | 'manual'
  sourceName: string
  sourceTitle: string
  sourceUrl?: string
}

// Memory cache to prevent duplicate captures
let lastCapturedText = ''
let lastCapturedTime = 0

// Run AppleScript to retrieve front application, active window/tab name, tab URL and selected text.
export function captureSelection(): Promise<CapturedSelection> {
  return new Promise((resolve) => {
    // Save original clipboard and clear it
    let oldClipboard = ''
    try {
      oldClipboard = clipboard.readText()
    } catch (e) {
      console.error('Failed to read old clipboard:', e)
    }
    
    clipboard.writeText('')

    // Simulate Cmd+C to copy current text selection
    exec('osascript -e \'tell application "System Events" to keystroke "c" using {command down}\'', (err) => {
      if (err) {
        console.error('Simulating copy keystroke failed:', err)
      }

      // Allow 150ms delay for system clipboard update
      setTimeout(() => {
        const selectedText = clipboard.readText().trim()

        // Restore clipboard
        try {
          clipboard.writeText(oldClipboard)
        } catch (e) {
          console.error('Failed to restore clipboard:', e)
        }

        // Get frontmost application name
        exec('osascript -e \'tell application "System Events" to name of first process whose frontmost is true\'', (err, stdout) => {
          if (err) {
            console.error('Failed to get frontmost app:', err)
            return resolve({
              text: selectedText || clipboard.readText().trim(),
              sourceType: 'manual',
              sourceName: 'Clipboard Fallback',
              sourceTitle: 'System Clipboard'
            })
          }

          const frontAppName = stdout.trim()
          
          // Inner helper to finish resolving capture selection
          const finish = (tabTitle = '', tabUrl = '') => {
            const isBrowser =
              frontAppName === 'Safari' ||
              frontAppName.includes('Google Chrome') ||
              frontAppName.includes('Brave') ||
              frontAppName.includes('Edge') ||
              frontAppName.includes('Vivaldi')

            resolve({
              text: selectedText || clipboard.readText().trim(),
              sourceType: isBrowser ? 'browser' : 'app',
              sourceName: frontAppName || 'Unknown App',
              sourceTitle: tabTitle || frontAppName || 'Unknown Window',
              sourceUrl: tabUrl || undefined
            })
          }

          // If frontmost application is a supported browser, retrieve Title and URL
          if (frontAppName === 'Safari') {
            exec('osascript -e \'tell application "Safari" to return name of front document & "###" & URL of front document\'', (err, stdout) => {
              if (!err && stdout) {
                const [title, url] = stdout.trim().split('###')
                finish(title, url)
              } else {
                finish()
              }
            })
          } else if (frontAppName.includes('Google Chrome')) {
            exec('osascript -e \'tell application "Google Chrome" to return title of active tab of front window & "###" & URL of active tab of front window\'', (err, stdout) => {
              if (!err && stdout) {
                const [title, url] = stdout.trim().split('###')
                finish(title, url)
              } else {
                finish()
              }
            })
          } else if (frontAppName.includes('Brave')) {
            exec('osascript -e \'tell application "Brave Browser" to return title of active tab of front window & "###" & URL of active tab of front window\'', (err, stdout) => {
              if (!err && stdout) {
                const [title, url] = stdout.trim().split('###')
                finish(title, url)
              } else {
                finish()
              }
            })
          } else if (frontAppName.includes('Edge') || frontAppName.includes('Microsoft Edge')) {
            exec('osascript -e \'tell application "Microsoft Edge" to return title of active tab of front window & "###" & URL of active tab of front window\'', (err, stdout) => {
              if (!err && stdout) {
                const [title, url] = stdout.trim().split('###')
                finish(title, url)
              } else {
                finish()
              }
            })
          } else if (frontAppName.includes('Vivaldi')) {
            exec('osascript -e \'tell application "Vivaldi" to return title of active tab of front window & "###" & URL of active tab of front window\'', (err, stdout) => {
              if (!err && stdout) {
                const [title, url] = stdout.trim().split('###')
                finish(title, url)
              } else {
                finish()
              }
            })
          } else {
            finish()
          }
        })
      }, 150)
    })
  })
}

// Process the capture, enforcing duplicate checks and writing to the database
export async function processCapture(formatType: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet' | 'quote' | 'definition' | 'important' | 'checklist' | 'same-line' | 'next-line'): Promise<{ success: boolean; message: string; note?: any }> {
  try {
    const capture = await captureSelection()
    const text = capture.text.trim()

    if (!text) {
      return { success: false, message: 'Selection is empty' }
    }

    // Duplicate detection settings
    const duplicateWindow = dbOps.getSetting<number>('duplicate_detection_window', 5000) // 5s default
    const duplicateBehavior = dbOps.getSetting<'ignore' | 'notify'>('duplicate_detection_behavior', 'notify')

    const now = Date.now()
    if (text === lastCapturedText && now - lastCapturedTime < duplicateWindow) {
      if (duplicateBehavior === 'ignore') {
        return { success: false, message: 'Duplicate capture ignored' }
      } else {
        return { success: false, message: 'Duplicate captured recently' }
      }
    }

    // Update capture cache
    lastCapturedText = text
    lastCapturedTime = now

    // Format content as HTML for Tiptap editor
    let formattedContent = ''
    switch (formatType) {
      case 'h1':
        formattedContent = `<h1>${escapeHtml(text)}</h1>`
        break
      case 'h2':
        formattedContent = `<h2>${escapeHtml(text)}</h2>`
        break
      case 'h3':
        formattedContent = `<h3>${escapeHtml(text)}</h3>`
        break
      case 'paragraph':
      case 'same-line':
      case 'next-line':
        formattedContent = `<p>${escapeHtml(text)}</p>`
        break
      case 'bullet':
        formattedContent = `<ul><li><p>${escapeHtml(text)}</p></li></ul>`
        break
      case 'quote':
        formattedContent = `<blockquote><p>${escapeHtml(text)}</p></blockquote>`
        break
      case 'definition':
        formattedContent = `<p><strong>Definition:</strong> ${escapeHtml(text)}</p>`
        break
      case 'important':
        formattedContent = `<div data-type="callout"><p>⚠️ <strong>Important:</strong> ${escapeHtml(text)}</p></div>`
        break
      case 'checklist':
        formattedContent = `<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${escapeHtml(text)}</p></div></li></ul>`
        break
      default:
        formattedContent = `<p>${escapeHtml(text)}</p>`
    }

    // Fetch default notebook
    const notebooks = dbOps.listNotebooks()
    const activeNotebookId = dbOps.getSetting<string>('default_notebook_id', notebooks[0]?.id || 'default')

    const cleanPlain = text
    const topic = text.length > 50 ? text.substring(0, 50) + '...' : text

    // Create note in database
    const newNote = dbOps.createNote({
      notebook_id: activeNotebookId,
      chapter: '',
      section: (formatType === 'same-line' || formatType === 'next-line') ? formatType : '',
      page: '',
      topic,
      subtopic: '',
      content: formattedContent,
      plain_text: cleanPlain,
      source_type: capture.sourceType,
      source_name: capture.sourceName,
      source_title: capture.sourceTitle,
      source_url: capture.sourceUrl
    })

    return {
      success: true,
      message: `${formatType.toUpperCase()} Saved`,
      note: newNote
    }
  } catch (error: any) {
    console.error('Failed to process capture:', error)
    return {
      success: false,
      message: error.message || 'Capture failed. Enable Accessibility permissions.'
    }
  }
}

// Simple HTML escaping helper
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
