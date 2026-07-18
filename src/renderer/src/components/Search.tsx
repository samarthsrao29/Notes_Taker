import React, { useEffect, useState, useRef } from 'react'

interface Note {
  id: string
  notebook_id: string
  topic: string
  plain_text: string
  source_type: string
  source_name?: string
  source_url?: string
  source_title?: string
  created_at: number
}

interface SearchProps {
  onSelectNote: (noteId: string) => void
}

export default function Search({ onSelectNote }: SearchProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus search input on mount
    inputRef.current?.focus()
    performSearch('')
  }, [])

  const performSearch = async (val: string): Promise<void> => {
    try {
      const data = await window.api.searchNotes(val)
      setResults(data)
    } catch (err) {
      console.error('Failed to search notes:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setQuery(val)
    performSearch(val)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 text-zinc-100 flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
          Global Search
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Instant search across titles, highlights, tags, books, and URLs</p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Type to search note contents, sources, titles, or tags..."
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500/50 outline-none rounded-xl px-12 py-3.5 text-zinc-200 placeholder-zinc-500 transition-colors shadow-2xl"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {query && (
          <button
            onClick={() => {
              setQuery('')
              performSearch('')
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results Listing */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Found {results.length} Matches
        </span>

        {results.length === 0 ? (
          <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-xl p-12 text-center text-zinc-500 glass-card">
            <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">No results found matching "{query}"</p>
            <p className="text-xs text-zinc-600 mt-1">Try searching for keywords, source applications, or tags.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((note) => (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className="bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/60 hover:border-purple-500/30 rounded-xl p-5 cursor-pointer transition-all duration-200 group flex flex-col justify-between glass-card shadow-lg hover:shadow-purple-500/5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-zinc-200 group-hover:text-purple-400 transition-colors line-clamp-1">
                      {note.topic}
                    </h4>
                    
                    {/* Source Badge */}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/50 text-zinc-400 uppercase tracking-wider shrink-0">
                      {note.source_name || 'Manual'}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                    {note.plain_text}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="font-mono">{new Date(note.created_at).toLocaleDateString()}</span>
                  
                  {note.source_title && (
                    <span className="truncate max-w-[200px]" title={note.source_title}>
                      {note.source_title}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
