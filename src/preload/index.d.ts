import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      listNotebooks: () => Promise<any[]>
      createNotebook: (name: string) => Promise<any>
      deleteNotebook: (id: string) => Promise<void>
      
      listNotes: (notebookId?: string) => Promise<any[]>
      getNote: (id: string) => Promise<any>
      createNote: (note: any) => Promise<any>
      updateNote: (id: string, updates: any) => Promise<any>
      deleteNote: (id: string) => Promise<void>
      getDailyNotes: (dateStr: string) => Promise<any[]>
      
      getTags: () => Promise<any[]>
      getNoteTags: (noteId: string) => Promise<any[]>
      addTagToNote: (noteId: string, tagName: string) => Promise<void>
      removeTagFromNote: (noteId: string, tagId: string) => Promise<void>
      
      searchNotes: (query: string) => Promise<any[]>
      
      listFlashcards: (noteId?: string) => Promise<any[]>
      createFlashcard: (noteId: string, q: string, a: string) => Promise<any>
      deleteFlashcard: (id: string) => Promise<void>
      
      getSetting: <T>(key: string, defaultValue: T) => Promise<T>
      setSetting: (key: string, value: any) => Promise<void>
      
      getStatsSummary: (days?: number) => Promise<any>
      
      triggerCapture: (format: any) => Promise<any>
      
      oauthLogin: () => Promise<string>
      oauthLogout: () => Promise<boolean>
      isOauthAuthenticated: () => Promise<boolean>
      listGoogleDriveFolders: () => Promise<any[]>
      createGoogleDriveFolder: (name: string) => Promise<any>
      selectLocalFolder: () => Promise<string | null>
      openPath: (path: string) => Promise<{ success: boolean; error?: string }>
      showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>
      
      triggerSync: () => Promise<boolean>
      
      aiSummary: (text: string) => Promise<string>
      aiExplain: (text: string) => Promise<string>
      aiFlashcards: (text: string) => Promise<any[]>
      aiQuiz: (text: string) => Promise<any[]>
      aiKeypoints: (text: string) => Promise<string>
      aiDefinitions: (text: string) => Promise<string>
      aiAutotags: (text: string) => Promise<string[]>
      
      processOcr: (imagePathOrBuffer: string) => Promise<string>
      
      exportFile: (noteId: string, format: 'md' | 'txt' | 'docx' | 'pdf') => Promise<any>
      
      onNoteCaptured: (callback: (event: any, data: any) => void) => () => void
      onCaptureStarted: (callback: (event: any) => void) => () => void
      onTriggerAiCapture: (callback: (event: any, data: any) => void) => () => void
      onCaptureActiveChanged: (callback: (event: any, active: boolean) => void) => () => void
    }
  }
}

