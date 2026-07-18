import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { dbOps } from './services/database'
import { processCapture } from './services/capture'
import { startOAuthFlow, logoutGoogle, isGoogleAuthenticated, listGoogleDriveFolders, createGoogleDriveFolder, clearOAuth2Client } from './services/oauth'
import { runSyncCycle, startSyncService, stopSyncService } from './services/sync'
import { aiOps } from './services/ai'
import { performOCR } from './services/ocr'
import { formatNoteAsMarkdown, formatNoteAsPlainText, exportToDocx, exportToPdf } from './services/export'
import { rebindShortcuts, unregisterAllShortcuts } from './services/shortcuts'
import { updateTrayMenu } from './services/tray'
import fs from 'fs'

export function registerIpcHandlers(window: BrowserWindow): void {
  // Shell opener
  ipcMain.on('open-external-url', (_, url: string) => {
    if (url) {
      shell.openExternal(url).catch((err) => console.error('Failed to open external url:', err))
    }
  })

  ipcMain.handle('shell:open-path', async (_, path: string) => {
    try {
      const err = await shell.openPath(path)
      return { success: !err, error: err }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('shell:show-item-in-folder', (_, path: string) => {
    try {
      shell.showItemInFolder(path)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // Database Handlers
  ipcMain.handle('db:list-notebooks', () => dbOps.listNotebooks())
  ipcMain.handle('db:create-notebook', (_, name: string) => dbOps.createNotebook(name))
  ipcMain.handle('db:delete-notebook', (_, id: string) => dbOps.deleteNotebook(id))
  
  ipcMain.handle('db:list-notes', (_, notebookId?: string) => dbOps.listNotes(notebookId))
  ipcMain.handle('db:get-note', (_, id: string) => dbOps.getNoteById(id))
  ipcMain.handle('db:create-note', (_, note: any) => dbOps.createNote(note))
  ipcMain.handle('db:update-note', (_, id: string, updates: any) => dbOps.updateNote(id, updates))
  ipcMain.handle('db:delete-note', (_, id: string) => dbOps.deleteNote(id))
  ipcMain.handle('db:get-daily-notes', (_, dateStr: string) => dbOps.getDailyNotes(dateStr))
  
  ipcMain.handle('db:get-tags', () => dbOps.getTags())
  ipcMain.handle('db:add-tag-to-note', (_, noteId: string, tagName: string) => dbOps.addTagToNote(noteId, tagName))
  ipcMain.handle('db:remove-tag-from-note', (_, noteId: string, tagId: string) => dbOps.removeTagFromNote(noteId, tagId))
  ipcMain.handle('db:get-note-tags', (_, noteId: string) => dbOps.getNoteTags(noteId))
  
  ipcMain.handle('db:search-notes', (_, query: string) => dbOps.searchNotes(query))
  
  ipcMain.handle('db:list-flashcards', (_, noteId?: string) => dbOps.listFlashcards(noteId))
  ipcMain.handle('db:create-flashcard', (_, noteId: string, q: string, a: string) => dbOps.createFlashcard(noteId, q, a))
  ipcMain.handle('db:delete-flashcard', (_, id: string) => dbOps.deleteFlashcard(id))
  
  ipcMain.handle('db:get-setting', (_, key: string, defaultValue: any) => dbOps.getSetting(key, defaultValue))
  ipcMain.handle('db:set-setting', (_, key: string, value: any) => {
    dbOps.setSetting(key, value)
    if (key === 'shortcuts_config') {
      rebindShortcuts(window)
    } else if (key === 'capture_active') {
      if (value) {
        rebindShortcuts(window)
        startSyncService()
      } else {
        unregisterAllShortcuts()
        stopSyncService()
      }
      updateTrayMenu()
    } else if (key === 'google_oauth_config') {
      clearOAuth2Client()
    }
  })
  
  ipcMain.handle('db:get-stats-summary', (_, days?: number) => dbOps.getStatsSummary(days))

  // Manual capture trigger
  ipcMain.handle('capture:trigger', (_, format: any) => processCapture(format))

  // OAuth Google handlers
  ipcMain.handle('oauth:login', () => startOAuthFlow())
  ipcMain.handle('oauth:logout', () => {
    logoutGoogle()
    return true
  })
  ipcMain.handle('oauth:is-auth', () => isGoogleAuthenticated())
  ipcMain.handle('oauth:list-folders', () => listGoogleDriveFolders())
  ipcMain.handle('oauth:create-folder', (_, name: string) => createGoogleDriveFolder(name))

  // Manual Sync trigger
  ipcMain.handle('sync:trigger', async () => {
    await runSyncCycle()
    return true
  })

  // AI service handlers
  ipcMain.handle('ai:summary', (_, text: string) => aiOps.generateSummary(text))
  ipcMain.handle('ai:explain', (_, text: string) => aiOps.explainSimply(text))
  ipcMain.handle('ai:flashcards', (_, text: string) => aiOps.generateFlashcards(text))
  ipcMain.handle('ai:quiz', (_, text: string) => aiOps.generateQuiz(text))
  ipcMain.handle('ai:keypoints', (_, text: string) => aiOps.extractKeyPoints(text))
  ipcMain.handle('ai:definitions', (_, text: string) => aiOps.generateDefinitions(text))
  ipcMain.handle('ai:autotags', (_, text: string) => aiOps.suggestTags(text))

  // OCR processor
  ipcMain.handle('ocr:process', (_, imagePathOrBuffer: string) => performOCR(imagePathOrBuffer))

  // Export File dialog and write handlers
  ipcMain.handle('export:file', async (_, noteId: string, format: 'md' | 'txt' | 'docx' | 'pdf') => {
    const note = dbOps.getNoteById(noteId)
    if (!note) throw new Error('Note not found')

    const topicStr = note.topic || 'untitled'
    let defaultName = topicStr.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    if (defaultName.length > 30) defaultName = defaultName.substring(0, 30)

    let extension = ''
    let filters: { name: string; extensions: string[] }[] = []

    switch (format) {
      case 'md':
        extension = 'md'
        filters = [{ name: 'Markdown Document', extensions: ['md'] }]
        break
      case 'txt':
        extension = 'txt'
        filters = [{ name: 'Plain Text File', extensions: ['txt'] }]
        break
      case 'docx':
        extension = 'docx'
        filters = [{ name: 'Word Document', extensions: ['docx'] }]
        break
      case 'pdf':
        extension = 'pdf'
        filters = [{ name: 'PDF Document', extensions: ['pdf'] }]
        break
    }

    const { filePath, canceled } = await dialog.showSaveDialog(window, {
      title: 'Export Note',
      defaultPath: `${defaultName}.${extension}`,
      filters
    })

    if (canceled || !filePath) return { success: false, message: 'Export canceled' }

    try {
      if (format === 'md') {
        const mdText = formatNoteAsMarkdown(note)
        fs.writeFileSync(filePath, mdText, 'utf-8')
      } else if (format === 'txt') {
        const plainText = formatNoteAsPlainText(note)
        fs.writeFileSync(filePath, plainText, 'utf-8')
      } else if (format === 'docx') {
        await exportToDocx(note, filePath)
      } else if (format === 'pdf') {
        await exportToPdf(note, filePath)
      }

      return { success: true, message: `Exported to ${filePath}` }
    } catch (err: any) {
      console.error('File export failed:', err)
      return { success: false, message: `Export failed: ${err.message}` }
    }
  })

  // Select local directory for notes sync
  ipcMain.handle('dialog:select-folder', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(window, {
      title: 'Select Note Sync Directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
}
