import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Database API
  listNotebooks: () => ipcRenderer.invoke('db:list-notebooks'),
  createNotebook: (name: string) => ipcRenderer.invoke('db:create-notebook', name),
  deleteNotebook: (id: string) => ipcRenderer.invoke('db:delete-notebook', id),

  listNotes: (notebookId?: string) => ipcRenderer.invoke('db:list-notes', notebookId),
  getNote: (id: string) => ipcRenderer.invoke('db:get-note', id),
  createNote: (note: any) => ipcRenderer.invoke('db:create-note', note),
  updateNote: (id: string, updates: any) => ipcRenderer.invoke('db:update-note', id, updates),
  deleteNote: (id: string) => ipcRenderer.invoke('db:delete-note', id),
  getDailyNotes: (dateStr: string) => ipcRenderer.invoke('db:get-daily-notes', dateStr),

  getTags: () => ipcRenderer.invoke('db:get-tags'),
  getNoteTags: (noteId: string) => ipcRenderer.invoke('db:get-note-tags', noteId),
  addTagToNote: (noteId: string, tagName: string) => ipcRenderer.invoke('db:add-tag-to-note', noteId, tagName),
  removeTagFromNote: (noteId: string, tagId: string) => ipcRenderer.invoke('db:remove-tag-from-note', noteId, tagId),

  searchNotes: (query: string) => ipcRenderer.invoke('db:search-notes', query),

  listFlashcards: (noteId?: string) => ipcRenderer.invoke('db:list-flashcards', noteId),
  createFlashcard: (noteId: string, q: string, a: string) => ipcRenderer.invoke('db:create-flashcard', noteId, q, a),
  deleteFlashcard: (id: string) => ipcRenderer.invoke('db:delete-flashcard', id),

  getSetting: (key: string, defaultValue: any) => ipcRenderer.invoke('db:get-setting', key, defaultValue),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('db:set-setting', key, value),

  getStatsSummary: (days?: number) => ipcRenderer.invoke('db:get-stats-summary', days),

  // Capture Trigger
  triggerCapture: (format: any) => ipcRenderer.invoke('capture:trigger', format),

  // Google Sync OAuth
  oauthLogin: () => ipcRenderer.invoke('oauth:login'),
  oauthLogout: () => ipcRenderer.invoke('oauth:logout'),
  isOauthAuthenticated: () => ipcRenderer.invoke('oauth:is-auth'),
  listGoogleDriveFolders: () => ipcRenderer.invoke('oauth:list-folders'),
  createGoogleDriveFolder: (name: string) => ipcRenderer.invoke('oauth:create-folder', name),
  selectLocalFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),

  // Sync Trigger
  triggerSync: () => ipcRenderer.invoke('sync:trigger'),

  // AI API
  aiSummary: (text: string) => ipcRenderer.invoke('ai:summary', text),
  aiExplain: (text: string) => ipcRenderer.invoke('ai:explain', text),
  aiFlashcards: (text: string) => ipcRenderer.invoke('ai:flashcards', text),
  aiQuiz: (text: string) => ipcRenderer.invoke('ai:quiz', text),
  aiKeypoints: (text: string) => ipcRenderer.invoke('ai:keypoints', text),
  aiDefinitions: (text: string) => ipcRenderer.invoke('ai:definitions', text),
  aiAutotags: (text: string) => ipcRenderer.invoke('ai:autotags', text),

  // OCR
  processOcr: (imagePathOrBuffer: string) => ipcRenderer.invoke('ocr:process', imagePathOrBuffer),

  // Export File
  exportFile: (noteId: string, format: 'md' | 'txt' | 'docx' | 'pdf') =>
    ipcRenderer.invoke('export:file', noteId, format),

  // Events from Main process
  onNoteCaptured: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('note-captured', callback)
    return () => {
      ipcRenderer.removeListener('note-captured', callback)
    }
  },
  onCaptureStarted: (callback: (event: any) => void) => {
    ipcRenderer.on('capture-started', callback)
    return () => {
      ipcRenderer.removeListener('capture-started', callback)
    }
  },
  onTriggerAiCapture: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('trigger-ai-capture', callback)
    return () => {
      ipcRenderer.removeListener('trigger-ai-capture', callback)
    }
  },
  onCaptureActiveChanged: (callback: (event: any, active: boolean) => void) => {
    ipcRenderer.on('capture-active-changed', callback)
    return () => {
      ipcRenderer.removeListener('capture-active-changed', callback)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

