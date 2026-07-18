import { dbOps, Note } from './database'
import fs from 'fs'
import path from 'path'

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false

// Start the background sync loop
export function startSyncService(): void {
  if (syncInterval) clearInterval(syncInterval)

  // Fetch sync frequency from settings, default to 30 seconds
  const intervalSeconds = dbOps.getSetting<number>('sync_interval_seconds', 30)

  syncInterval = setInterval(async () => {
    await runSyncCycle()
  }, intervalSeconds * 1000)

  // Run immediately on boot
  runSyncCycle().catch((err) => console.error('Initial sync cycle failed:', err))
}

// Stop the background sync loop
export function stopSyncService(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

// Triggered manually or by background timer
export async function runSyncCycle(): Promise<void> {
  if (isSyncing) return
  isSyncing = true

  try {
    // 1. Check Local Sync Folder
    const syncFolder = dbOps.getSetting<string | null>('local_sync_folder_path', null)
    if (!syncFolder || !fs.existsSync(syncFolder)) {
      isSyncing = false
      return
    }

    // Verify / Recreate / Backfill files for all notebooks
    const notebooks = dbOps.listNotebooks()
    for (const nb of notebooks) {
      await getOrCreateLocalFileForNotebook(syncFolder, nb.id)
    }

    // 2. Retrieve Pending Queue Items
    const queueItems = dbOps.getPendingSyncItems(10) // Process in batches of 10
    if (queueItems.length === 0) {
      isSyncing = false
      return
    }

    for (const item of queueItems) {
      try {
        const note: Note = JSON.parse(item.payload)

        // Resolve local file for the note's notebook
        const notebookPath = await getOrCreateLocalFileForNotebook(syncFolder, note.notebook_id)

        if (item.action === 'insert') {
          await appendNoteToLocalFile(notebookPath, note)
        } else if (item.action === 'update') {
          await appendNoteUpdateToLocalFile(notebookPath, note)
        }

        // Successfully synced
        dbOps.removeSyncItem(item.id)
        dbOps.markNoteSynced(note.id)
        console.log(`Synced note ${note.id} successfully to local file ${notebookPath}`)
      } catch (err: any) {
        console.error(`Sync failed for item ${item.id}:`, err)
        const retry = item.retry_count + 1
        dbOps.failSyncItem(item.id, retry, err.message || 'Unknown sync error')
      }
    }
  } catch (error) {
    console.error('Error in sync cycle:', error)
  } finally {
    isSyncing = false
  }
}

// Get the local file path linked to a notebook, or create a new one
async function getOrCreateLocalFileForNotebook(syncFolder: string, notebookId: string): Promise<string> {
  // Get notebook name
  const notebooks = dbOps.listNotebooks()
  const notebook = notebooks.find((n) => n.id === notebookId)
  const notebookName = notebook ? notebook.name : 'My Highlights'

  // Clean notebook name to make a safe filename
  const safeName = notebookName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filePath = path.join(syncFolder, `smart-notes-${safeName}.txt`)

  if (!fs.existsSync(filePath)) {
    // Create the text file and write a title header
    const titleHeader = `Smart Notes - ${notebookName}\n\nThis file is automatically kept in sync with your local highlights.\n\n`
    fs.writeFileSync(filePath, titleHeader, 'utf-8')

    // BACKFILL: Write all existing notes for this notebook to the new file!
    const notebookNotes = dbOps.listNotes(notebookId)
    // Sort notes in ascending order of creation so they append chronologically
    const sortedNotes = notebookNotes.sort((a, b) => a.created_at - b.created_at)

    for (const note of sortedNotes) {
      await appendNoteToLocalFile(filePath, note)
    }
  }

  return filePath
}

// Appends note selection, formatting, and source metadata to the local Text file
async function appendNoteToLocalFile(filePath: string, note: Note): Promise<void> {
  const isContinuation = note.section === 'same-line' || note.section === 'next-line'
  
  if (isContinuation && fs.existsSync(filePath)) {
    const fileStat = fs.statSync(filePath)
    if (fileStat.size > 50) {
      if (note.section === 'same-line') {
        // Same line: append space followed by plain text
        fs.appendFileSync(filePath, ` ${note.plain_text}`, 'utf-8')
      } else {
        // Next line: append a newline followed by plain text
        fs.appendFileSync(filePath, `\n\n${note.plain_text}`, 'utf-8')
      }
      return
    }
  }

  const dateStr = new Date(note.created_at).toLocaleString()
  const divider = '\n\n----------------------------------------\n'
  const metaText = `Source: ${note.source_name || 'Manual'} | Title: ${note.source_title || 'Untitled'} | Captured: ${dateStr}\n`
  const linkText = note.source_url ? `Link: ${note.source_url}\n` : ''
  const quoteText = `"${note.plain_text}"\n`

  const content = divider + metaText + linkText + quoteText
  fs.appendFileSync(filePath, content, 'utf-8')
}

// Appends note updates (revision updates) to the local Text file
async function appendNoteUpdateToLocalFile(filePath: string, note: Note): Promise<void> {
  const dateStr = new Date(note.updated_at).toLocaleString()
  const updateMsg = `\n[Edited on ${dateStr}]: "${note.plain_text}"\n`
  fs.appendFileSync(filePath, updateMsg, 'utf-8')
}
