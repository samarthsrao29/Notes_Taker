import React, { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'

interface Note {
  id: string
  notebook_id: string
  chapter?: string
  section?: string
  page?: string
  topic: string
  subtopic?: string
  content: string
  plain_text: string
  source_type: string
  source_name?: string
  source_url?: string
  source_title?: string
  created_at: number
  updated_at: number
  sync_status: string
}



interface EditorProps {
  noteId: string | null
  onTriggerToast: (text: string, type: 'success' | 'error') => void
  onDeleteNote: (id: string) => void
}

export default function Editor({ noteId, onTriggerToast, onDeleteNote }: EditorProps): React.JSX.Element {
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [chapter, setChapter] = useState('')
  const [section, setSection] = useState('')
  const [page, setPage] = useState('')


  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef(true)

  // Configure Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Avoid auto-saving on initial setting of content
      if (isInitialLoad.current) {
        isInitialLoad.current = false
        return
      }
      triggerAutoSave(editor.getHTML(), editor.getText())
    }
  })

  // Load note details when noteId updates
  useEffect(() => {
    if (noteId) {
      loadNote(noteId)
    } else {
      setNote(null)
      setTitle('')
      editor?.commands.setContent('')
    }
  }, [noteId, editor])

  const loadNote = async (id: string): Promise<void> => {
    try {
      const data = await window.api.getNote(id)
      if (data) {
        isInitialLoad.current = true // block auto-save triggers on setContent
        setNote(data)
        setTitle(data.topic)
        setChapter(data.chapter || '')
        setSection(data.section || '')
        setPage(data.page || '')
        
        editor?.commands.setContent(data.content)
      }
    } catch (err) {
      console.error('Failed to load note:', err)
      onTriggerToast('Failed to load note', 'error')
    }
  }

  // Debounced auto-save function
  const triggerAutoSave = (htmlContent: string, plainText: string): void => {
    if (!noteId) return

    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)

    autoSaveTimeout.current = setTimeout(async () => {
      try {
        const updated = await window.api.updateNote(noteId, {
          content: htmlContent,
          plain_text: plainText
        })
        setNote(updated)
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, 600) // 600ms debounce
  }

  // Save metadata modifications (Title, Chapter, Section, Page)
  const saveMetadata = async (updates: Partial<Note>): Promise<void> => {
    if (!noteId) return
    try {
      const updated = await window.api.updateNote(noteId, updates)
      setNote(updated)
    } catch (err) {
      console.error('Failed to save metadata:', err)
    }
  }

  // Export note trigger
  const handleExport = async (format: 'md' | 'txt' | 'docx' | 'pdf'): Promise<void> => {
    if (!noteId) return
    try {
      const res = await window.api.exportFile(noteId, format)
      if (res.success) {
        onTriggerToast(res.message, 'success')
      } else {
        onTriggerToast(res.message, 'error')
      }
    } catch (err: any) {
      console.error(err)
      onTriggerToast(`Export failed: ${err.message}`, 'error')
    }
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center flex flex-col items-center gap-4">
          <svg className="w-16 h-16 text-zinc-700 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h2 className="text-lg font-bold text-zinc-400">No Note Selected</h2>
          <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
            Select a note from the sidebar lists, perform a global search, or use your shortcuts in another app to capture a highlight instantly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden text-zinc-200">
      
      {/* Editor & Content panel */}
      <div className="flex-1 flex flex-col overflow-y-auto p-8 gap-6">
        
        {/* Title & Metadata Top Bar */}
        <div className="flex flex-col gap-2">
          
          {/* Note Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              saveMetadata({ topic: e.target.value })
            }}
            placeholder="Untitled Note..."
            className="w-full bg-transparent border-none text-2xl font-bold text-zinc-100 outline-none placeholder-zinc-700"
          />

          {/* Sync Status Badge & Delete Note */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                note.sync_status === 'synced'
                  ? 'bg-blue-950/30 border border-blue-500/30 text-blue-400'
                  : note.sync_status === 'failed'
                    ? 'bg-rose-950/30 border border-rose-500/30 text-rose-400'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  note.sync_status === 'synced'
                    ? 'bg-blue-400'
                    : note.sync_status === 'failed'
                      ? 'bg-rose-400'
                      : 'bg-zinc-550 animate-pulse'
                }`}></span>
                {note.sync_status === 'synced' ? 'Synced Local' : note.sync_status === 'failed' ? 'Sync Failed' : 'Queue Pending'}
              </span>

              {note.source_name && (
                <span className="text-xs text-zinc-400 truncate max-w-sm">
                  Captured from <strong>{note.source_name}</strong>
                  {note.source_url && (
                    <a
                      href={note.source_url}
                      onClick={(e) => {
                        e.preventDefault()
                        window.electron.ipcRenderer.send('open-external-url', note.source_url)
                      }}
                      className="text-blue-450 hover:underline ml-1"
                    >
                      (link)
                    </a>
                  )}
                </span>
              )}
            </div>

            <button
              onClick={() => onDeleteNote(note.id)}
              className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5 hover:bg-zinc-900 rounded-lg text-xs font-semibold flex items-center gap-1 border border-transparent hover:border-rose-900/30"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Note
            </button>
          </div>
        </div>

        {/* Source metadata details form */}
        <div className="grid grid-cols-3 gap-4 border border-zinc-800 bg-zinc-950/20 p-4 rounded-xl text-xs">
          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-zinc-500 font-bold tracking-wider uppercase text-[10px]">Chapter</span>
            <input
              type="text"
              value={chapter}
              onChange={(e) => {
                setChapter(e.target.value)
                saveMetadata({ chapter: e.target.value })
              }}
              placeholder="e.g. Chapter 1..."
              className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 outline-none rounded-lg p-2 text-zinc-200 placeholder-zinc-700 transition-colors font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-zinc-500 font-bold tracking-wider uppercase text-[10px]">Section</span>
            <input
              type="text"
              value={section}
              onChange={(e) => {
                setSection(e.target.value)
                saveMetadata({ section: e.target.value })
              }}
              placeholder="e.g. Introduction..."
              className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 outline-none rounded-lg p-2 text-zinc-200 placeholder-zinc-700 transition-colors font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5 text-left">
            <span className="text-zinc-500 font-bold tracking-wider uppercase text-[10px]">Page Number</span>
            <input
              type="text"
              value={page}
              onChange={(e) => {
                setPage(e.target.value)
                saveMetadata({ page: e.target.value })
              }}
              placeholder="e.g. Page 12..."
              className="bg-zinc-900 border border-zinc-800/80 focus:border-zinc-700 outline-none rounded-lg p-2 text-zinc-200 placeholder-zinc-700 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Custom Editor Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap border border-zinc-800/80 bg-zinc-950/20 p-2 rounded-xl shadow-sm">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${editor?.isActive('bold') ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold italic ${editor?.isActive('italic') ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Italic"
          >
            I
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${editor?.isActive('heading', { level: 1 }) ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${editor?.isActive('heading', { level: 2 }) ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Heading 2"
          >
            H2
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs ${editor?.isActive('bulletList') ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Bullet List"
          >
            List
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`px-3 py-1.5 rounded-lg transition-colors text-xs ${editor?.isActive('blockquote') ? 'bg-zinc-800 text-white border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-205 hover:bg-zinc-900/40'}`}
            title="Blockquote"
          >
            Quote
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
          <button
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="p-1.5 rounded-lg hover:bg-zinc-900/40 text-zinc-400 disabled:opacity-30 transition-colors text-xs"
            title="Undo"
          >
            ↺
          </button>
          <button
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="p-1.5 rounded-lg hover:bg-zinc-900/40 text-zinc-400 disabled:opacity-30 transition-colors text-xs"
            title="Redo"
          >
            ↻
          </button>

          {/* Export Menu */}
          <div className="ml-auto flex items-center bg-zinc-950/70 border border-zinc-800 p-0.5 rounded-lg">
            {['md', 'txt', 'docx', 'pdf'].map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt as any)}
                className="hover:bg-zinc-900 text-[10px] uppercase font-bold px-2.5 py-1 rounded transition-colors text-zinc-450"
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Editor Body Area */}
        <div className="flex-1 min-h-[300px]">
          <EditorContent editor={editor} className="h-full" />
        </div>

        {/* Tiptap Floating Bubble Menu */}
        {editor && (
          <BubbleMenu editor={editor}>
            <div className="editor-floating-menu">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`px-2 py-1 text-xs font-bold rounded hover:bg-zinc-800 ${editor.isActive('bold') ? 'text-purple-400' : 'text-zinc-300'}`}
              >
                Bold
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 text-xs font-bold italic rounded hover:bg-zinc-800 ${editor.isActive('italic') ? 'text-purple-400' : 'text-zinc-300'}`}
              >
                Italic
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`px-2 py-1 text-xs font-bold rounded hover:bg-zinc-800 ${editor.isActive('highlight') ? 'text-purple-400' : 'text-zinc-300'}`}
              >
                Highlight
              </button>
            </div>
          </BubbleMenu>
        )}

        {/* Shortcut Cheat-Sheet Helper Banner */}
        <div className="mt-auto border-t border-zinc-800/60 pt-4 flex items-center justify-between text-[11px] text-zinc-500 font-medium select-none">
          <span className="text-zinc-650 font-bold uppercase tracking-wider text-[9px]">Capture Shortcut Cheat-Sheet:</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <kbd className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘N</kbd>
              <span>Paragraph</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘T</kbd>
              <span>Header H1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘Q</kbd>
              <span>Quote</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘B</kbd>
              <span>Bullet List</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘I</kbd>
              <span>Callout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
