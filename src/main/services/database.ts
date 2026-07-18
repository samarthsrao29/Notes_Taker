import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface Notebook {
  id: string
  name: string
  created_at: number
  updated_at: number
}

export interface Note {
  id: string
  notebook_id: string
  chapter?: string
  section?: string
  page?: string
  topic?: string
  subtopic?: string
  content: string
  plain_text: string
  source_type: 'browser' | 'app' | 'ocr' | 'manual'
  source_name?: string
  source_url?: string
  source_title?: string
  created_at: number
  updated_at: number
  sync_status: 'pending' | 'synced' | 'failed'
  sync_error?: string
}

export interface Tag {
  id: string
  name: string
  created_at: number
}

export interface Flashcard {
  id: string
  note_id: string
  question: string
  answer: string
  created_at: number
}

export interface StatEvent {
  id?: number
  event_type: 'capture' | 'edit' | 'ocr' | 'ai_summary' | 'flashcard' | 'search'
  timestamp: number
  metadata?: string // JSON string
}

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    initDb()
  }
  return db
}

export function initDb(customPath?: string): Database.Database {
  let dbPath = customPath
  if (!dbPath) {
    if (typeof app !== 'undefined' && app.getPath) {
      dbPath = path.join(app.getPath('userData'), 'database.sqlite')
    } else {
      dbPath = ':memory:'
    }
  }

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  // Run migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      chapter TEXT,
      section TEXT,
      page TEXT,
      topic TEXT,
      subtopic TEXT,
      content TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_name TEXT,
      source_url TEXT,
      source_title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY(note_id, tag_id),
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Create Virtual Table for FTS5 full-text search
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        note_id UNINDEXED,
        topic,
        plain_text,
        source_name,
        source_title
      );
    `)

    // Create Triggers to automatically keep notes_fts in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(note_id, topic, plain_text, source_name, source_title)
        VALUES (new.id, new.topic, new.plain_text, new.source_name, new.source_title);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        UPDATE notes_fts SET
          topic = new.topic,
          plain_text = new.plain_text,
          source_name = new.source_name,
          source_title = new.source_title
        WHERE note_id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        DELETE FROM notes_fts WHERE note_id = old.id;
      END;
    `)
  } catch (error) {
    console.error('Failed to initialize SQLite FTS5 extension. Text search will fallback to LIKE queries.', error)
  }

  // Create default notebook if none exists
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM notebooks')
  const notebookCount = (countStmt.get() as { count: number }).count
  if (notebookCount === 0) {
    const defaultNotebookId = 'default'
    const now = Date.now()
    db.prepare('INSERT INTO notebooks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      defaultNotebookId,
      'My Highlights',
      now,
      now
    )
  }

  return db
}

// Database Helper Actions
export const dbOps = {
  // Notebooks
  listNotebooks(): Notebook[] {
    return getDb().prepare('SELECT * FROM notebooks ORDER BY name ASC').all() as Notebook[]
  },

  createNotebook(name: string): Notebook {
    const id = uuidv4()
    const now = Date.now()
    getDb().prepare('INSERT INTO notebooks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      id,
      name,
      now,
      now
    )
    return { id, name, created_at: now, updated_at: now }
  },

  deleteNotebook(id: string): void {
    getDb().prepare('DELETE FROM notebooks WHERE id = ?').run(id)
  },

  // Notes
  listNotes(notebookId?: string): Note[] {
    if (notebookId) {
      return getDb().prepare('SELECT * FROM notes WHERE notebook_id = ? ORDER BY created_at DESC').all(notebookId) as Note[]
    }
    return getDb().prepare('SELECT * FROM notes ORDER BY created_at DESC').all() as Note[]
  },

  getNoteById(id: string): Note | undefined {
    return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  },

  createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at' | 'sync_status'>): Note {
    const id = uuidv4()
    const now = Date.now()
    const newNote: Note = {
      ...note,
      id,
      created_at: now,
      updated_at: now,
      sync_status: 'pending'
    }

    getDb().prepare(`
      INSERT INTO notes (
        id, notebook_id, chapter, section, page, topic, subtopic,
        content, plain_text, source_type, source_name, source_url, source_title,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newNote.id,
      newNote.notebook_id,
      newNote.chapter || null,
      newNote.section || null,
      newNote.page || null,
      newNote.topic || null,
      newNote.subtopic || null,
      newNote.content,
      newNote.plain_text,
      newNote.source_type,
      newNote.source_name || null,
      newNote.source_url || null,
      newNote.source_title || null,
      newNote.created_at,
      newNote.updated_at,
      newNote.sync_status
    )

    // Log a capture event to statistics
    this.logStatEvent('capture', { noteId: id })

    // Queue sync
    this.queueSync(id, 'insert', JSON.stringify(newNote))

    return newNote
  },

  updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'created_at' | 'updated_at'>>): Note {
    const now = Date.now()
    const current = this.getNoteById(id)
    if (!current) throw new Error(`Note ${id} not found`)

    const updated = {
      ...current,
      ...updates,
      updated_at: now,
      sync_status: 'pending' as const
    }

    getDb().prepare(`
      UPDATE notes SET
        notebook_id = ?, chapter = ?, section = ?, page = ?, topic = ?, subtopic = ?,
        content = ?, plain_text = ?, source_type = ?, source_name = ?, source_url = ?, source_title = ?,
        updated_at = ?, sync_status = ?, sync_error = NULL
      WHERE id = ?
    `).run(
      updated.notebook_id,
      updated.chapter || null,
      updated.section || null,
      updated.page || null,
      updated.topic || null,
      updated.subtopic || null,
      updated.content,
      updated.plain_text,
      updated.source_type,
      updated.source_name || null,
      updated.source_url || null,
      updated.source_title || null,
      updated.updated_at,
      updated.sync_status,
      id
    )

    // Log edit statistics
    this.logStatEvent('edit', { noteId: id })

    // Queue sync update
    this.queueSync(id, 'update', JSON.stringify(updated))

    return updated
  },

  deleteNote(id: string): void {
    const current = this.getNoteById(id)
    if (current) {
      // Queue sync delete before deleting locally
      this.queueSync(id, 'delete', JSON.stringify(current))
    }
    getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
  },

  // Daily Notes (Notes created today or on a specific ISO date)
  getDailyNotes(dateStr: string): Note[] {
    // dateStr is 'YYYY-MM-DD'
    const start = new Date(dateStr + 'T00:00:00').getTime()
    const end = new Date(dateStr + 'T23:59:59.999').getTime()
    return getDb().prepare('SELECT * FROM notes WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC').all(start, end) as Note[]
  },

  // Tags
  getTags(): Tag[] {
    return getDb().prepare('SELECT * FROM tags ORDER BY name ASC').all() as Tag[]
  },

  addTagToNote(noteId: string, tagName: string): void {
    const cleanName = tagName.trim().toLowerCase()
    if (!cleanName) return

    const transaction = getDb().transaction(() => {
      // Get or create tag
      let tag = getDb().prepare('SELECT * FROM tags WHERE name = ?').get(cleanName) as Tag | undefined
      let tagId: string
      if (!tag) {
        tagId = uuidv4()
        const now = Date.now()
        getDb().prepare('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)').run(tagId, cleanName, now)
      } else {
        tagId = tag.id
      }

      // Link note to tag if not already linked
      getDb().prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId)
    })
    transaction()
  },

  removeTagFromNote(noteId: string, tagId: string): void {
    getDb().prepare('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?').run(noteId, tagId)
  },

  getNoteTags(noteId: string): Tag[] {
    return getDb().prepare(`
      SELECT t.* FROM tags t
      JOIN note_tags nt ON nt.tag_id = t.id
      WHERE nt.note_id = ?
    `).all(noteId) as Tag[]
  },

  // Search Notes (Fast full-text search with FTS5 or fallback)
  searchNotes(query: string): Note[] {
    const cleanQuery = query.trim()
    if (!cleanQuery) return this.listNotes()

    this.logStatEvent('search', { query })

    try {
      // Using FTS5 match query
      // Match query format: "query*"
      const ftsResults = getDb().prepare(`
        SELECT n.* FROM notes n
        JOIN notes_fts fts ON fts.note_id = n.id
        WHERE notes_fts MATCH ?
        ORDER BY rank ASC
      `).all(`"${cleanQuery}" OR "${cleanQuery}*"`) as Note[]
      
      if (ftsResults.length > 0) return ftsResults
    } catch (e) {
      console.warn('FTS5 search failed, falling back to LIKE', e)
    }

    // Fallback search
    const likeQuery = `%${cleanQuery}%`
    return getDb().prepare(`
      SELECT DISTINCT n.* FROM notes n
      LEFT JOIN note_tags nt ON nt.note_id = n.id
      LEFT JOIN tags t ON t.id = nt.tag_id
      WHERE n.topic LIKE ? OR n.plain_text LIKE ? OR n.source_name LIKE ? OR n.source_title LIKE ? OR t.name LIKE ?
      ORDER BY n.created_at DESC
    `).all(likeQuery, likeQuery, likeQuery, likeQuery, likeQuery) as Note[]
  },

  // Flashcards
  listFlashcards(noteId?: string): Flashcard[] {
    if (noteId) {
      return getDb().prepare('SELECT * FROM flashcards WHERE note_id = ? ORDER BY created_at DESC').all(noteId) as Flashcard[]
    }
    return getDb().prepare('SELECT * FROM flashcards ORDER BY created_at DESC').all() as Flashcard[]
  },

  createFlashcard(noteId: string, question: string, answer: string): Flashcard {
    const id = uuidv4()
    const now = Date.now()
    getDb().prepare('INSERT INTO flashcards (id, note_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      noteId,
      question,
      answer,
      now
    )
    this.logStatEvent('flashcard', { noteId })
    return { id, note_id: noteId, question, answer, created_at: now }
  },

  deleteFlashcard(id: string): void {
    getDb().prepare('DELETE FROM flashcards WHERE id = ?').run(id)
  },

  // Settings
  getSetting<T>(key: string, defaultValue: T): T {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return defaultValue
    try {
      return JSON.parse(row.value) as T
    } catch {
      return defaultValue
    }
  },

  setSetting(key: string, value: any): void {
    const jsonStr = JSON.stringify(value)
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, jsonStr)
  },

  // Stats / Dashboard
  logStatEvent(eventType: StatEvent['event_type'], metadataObj?: object): void {
    const now = Date.now()
    const metadataStr = metadataObj ? JSON.stringify(metadataObj) : null
    getDb().prepare('INSERT INTO statistics (event_type, timestamp, metadata) VALUES (?, ?, ?)').run(
      eventType,
      now,
      metadataStr
    )
  },

  getStatsSummary(days = 7): {
    highlightsCaptured: number
    notesCreated: number
    flashcardsGenerated: number
    aiFeaturesUsed: number
    dailyHistory: { date: string; captures: number }[]
  } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    // Highlights captured count
    const captures = (getDb().prepare('SELECT COUNT(*) as count FROM notes WHERE created_at >= ?').get(cutoff) as { count: number }).count

    // Manual notes (without source_type browser or ocr)
    const manualNotes = (getDb().prepare("SELECT COUNT(*) as count FROM notes WHERE source_type = 'manual' AND created_at >= ?").get(cutoff) as { count: number }).count

    // Flashcards
    const flashcards = (getDb().prepare('SELECT COUNT(*) as count FROM flashcards WHERE created_at >= ?').get(cutoff) as { count: number }).count

    // AI summary count
    const aiUsed = (getDb().prepare("SELECT COUNT(*) as count FROM statistics WHERE event_type IN ('ai_summary', 'flashcard') AND timestamp >= ?").get(cutoff) as { count: number }).count

    // Daily progress history
    const dailyHistory: { date: string; captures: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const start = new Date(dateStr + 'T00:00:00').getTime()
      const end = new Date(dateStr + 'T23:59:59.999').getTime()

      const dailyCount = (getDb().prepare('SELECT COUNT(*) as count FROM notes WHERE created_at >= ? AND created_at <= ?').get(start, end) as { count: number }).count
      dailyHistory.push({
        date: dateStr,
        captures: dailyCount
      })
    }

    return {
      highlightsCaptured: captures,
      notesCreated: manualNotes,
      flashcardsGenerated: flashcards,
      aiFeaturesUsed: aiUsed,
      dailyHistory
    }
  },

  // Sync Queue management
  queueSync(noteId: string, action: string, payload: string): void {
    const now = Date.now()
    getDb().prepare(`
      INSERT INTO sync_queue (note_id, action, payload, retry_count, next_retry_at, created_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(noteId, action, payload, now, now)
  },

  getPendingSyncItems(limit = 20): { id: number; note_id: string; action: string; payload: string; retry_count: number }[] {
    const now = Date.now()
    return getDb().prepare(`
      SELECT id, note_id, action, payload, retry_count
      FROM sync_queue
      WHERE next_retry_at <= ?
      ORDER BY created_at ASC
      LIMIT ?
    `).all(now, limit) as { id: number; note_id: string; action: string; payload: string; retry_count: number }[]
  },

  removeSyncItem(id: number): void {
    getDb().prepare('DELETE FROM sync_queue WHERE id = ?').run(id)
  },

  failSyncItem(id: number, retryCount: number, errorMsg: string): void {
    const backoffMinutes = Math.min(Math.pow(2, retryCount), 1440) // cap backoff at 24 hours (1440 mins)
    const nextRetry = Date.now() + backoffMinutes * 60 * 1000

    getDb().prepare(`
      UPDATE sync_queue
      SET retry_count = ?, next_retry_at = ?
      WHERE id = ?
    `).run(retryCount, nextRetry, id)

    // Also update the note's status to failed
    const row = getDb().prepare('SELECT note_id FROM sync_queue WHERE id = ?').get(id) as { note_id: string } | undefined
    if (row) {
      getDb().prepare('UPDATE notes SET sync_status = \'failed\', sync_error = ? WHERE id = ?').run(errorMsg, row.note_id)
    }
  },

  markNoteSynced(noteId: string): void {
    getDb().prepare('UPDATE notes SET sync_status = \'synced\', sync_error = NULL WHERE id = ?').run(noteId)
  }
}
