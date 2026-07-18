import React, { useEffect, useState } from 'react'

interface Notebook {
  id: string
  name: string
}

interface LocalDashboardProps {
  localSyncPath: string
  onOpenSettings: () => void
  onTriggerToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

export default function LocalDashboard({
  localSyncPath,
  onOpenSettings,
  onTriggerToast
}: LocalDashboardProps): React.JSX.Element {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just Now')


  const fetchNotebooks = async (): Promise<void> => {
    try {
      const list = await window.api.listNotebooks()
      setNotebooks(list)
    } catch (err) {
      console.error('Failed to load notebooks:', err)
    }
  }

  useEffect(() => {
    fetchNotebooks()

    
    // Listen for note captured event to refresh notebooks list
    const cleanupCaptured = window.api.onNoteCaptured(() => {
      fetchNotebooks()
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    })
    return cleanupCaptured
  }, [])

  const getTxtFileName = (name: string): string => {
    return `smart-notes-${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
  }

  const handleOpenFolder = async (): Promise<void> => {
    if (!localSyncPath) return
    const res = await window.api.openPath(localSyncPath)
    if (!res.success) {
      onTriggerToast(`Failed to open folder: ${res.error}`, 'error')
    }
  }

  const handleOpenFile = async (notebookName: string): Promise<void> => {
    const filename = getTxtFileName(notebookName)
    const filePath = `${localSyncPath}/${filename}`
    const res = await window.api.openPath(filePath)
    if (!res.success) {
      onTriggerToast(`Failed to open file: ${res.error}. Make sure it has been synced.`, 'error')
    }
  }

  const handleShowInFinder = async (notebookName: string): Promise<void> => {
    const filename = getTxtFileName(notebookName)
    const filePath = `${localSyncPath}/${filename}`
    const res = await window.api.showItemInFolder(filePath)
    if (!res.success) {
      onTriggerToast(`Failed to reveal file: ${res.error}`, 'error')
    }
  }

  const handleSyncNow = async (): Promise<void> => {
    try {
      setSyncing(true)
      onTriggerToast('Starting local sync...', 'info')
      const success = await window.api.triggerSync()
      if (success) {
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        onTriggerToast('✓ Local sync completed!', 'success')
      } else {
        onTriggerToast('Sync complete with warnings', 'info')
      }
    } catch (err: any) {
      console.error(err)
      onTriggerToast(`Sync failed: ${err.message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }



  return (
    <div className="dashboard-container animate-fade-in">
      
      {/* Decorative radial background highlights for premium Apple depth */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header section */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-header-title">
            Sync Dashboard
          </h1>
          <p className="dashboard-header-subtitle">
            Offline synchronization status, directory configurations, and generated Markdown notes.
          </p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="apple-btn-primary no-drag"
        >
          {syncing ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          )}
          <span>Sync Now</span>
        </button>
      </div>

      {/* Stats Quick Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card-title">Connection</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-bold text-zinc-150 font-sans">Fully Offline (Local)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-card-title">Active Sync Files</span>
          <span className="stat-card-value">{notebooks.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-title">Last Local Sync</span>
          <span className="stat-card-value text-zinc-300">{lastSyncTime}</span>
        </div>
      </div>



      {/* Sync Directory Status Card */}
      <div className="sync-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/10">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-sans">
              Local Storage Folder
            </h2>
            <span className="text-[11px] text-zinc-500 font-medium">All highlight captures are synchronized to this folder</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-sans">
            Directory Path
          </span>
          <span className="sync-path-box">
            📁 {localSyncPath || 'Not Set'}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleOpenFolder}
            className="apple-btn-secondary"
          >
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-4" />
            </svg>
            Reveal Folder in Finder
          </button>
          <button
            onClick={onOpenSettings}
            className="apple-btn-secondary bg-[#1c1c1e]/60 border-[#3a3a3c] text-zinc-400"
          >
            Change Sync Folder...
          </button>
        </div>
      </div>

      {/* Sync status per notebook file */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1 font-sans">
          Generated Text Files ({notebooks.length})
        </h2>

        <div className="finder-table-container">
          <table className="finder-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Sync Location Path</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notebooks.map((nb) => {
                const filename = getTxtFileName(nb.name)
                return (
                  <tr key={nb.id}>
                    <td className="font-semibold text-zinc-200">
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{filename}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-zinc-500 max-w-sm truncate" title={`${localSyncPath}/${filename}`}>
                      {localSyncPath}/{filename}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleOpenFile(nb.name)}
                          className="apple-btn-action"
                        >
                          Open File
                        </button>
                        <button
                          onClick={() => handleShowInFinder(nb.name)}
                          className="apple-btn-action"
                        >
                          Show in Finder
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {notebooks.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-zinc-600 italic font-medium">
                    No notebook files created yet. Please create a notebook in the sidebar to sync highlights.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capture Help Banner */}
      <div className="mt-auto border-t border-[#2d2d2f] pt-6 flex items-center justify-between text-[11px] text-zinc-550 font-medium select-none z-10">
        <span className="text-zinc-650 font-bold uppercase tracking-wider text-[9px] font-sans">Global Hotkeys:</span>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-zinc-900 border border-[#2d2d2f] text-zinc-300 px-2 py-0.5 rounded-lg font-mono text-[9px] shadow-sm">⌥C</kbd>
            <span className="font-sans text-zinc-500 text-[10px]">Full Block Capture</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-zinc-900 border border-[#2d2d2f] text-zinc-300 px-2 py-0.5 rounded-lg font-mono text-[9px] shadow-sm">⌥S</kbd>
            <span className="font-sans text-zinc-500 text-[10px]">Append Same Line</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-zinc-900 border border-[#2d2d2f] text-zinc-300 px-2 py-0.5 rounded-lg font-mono text-[9px] shadow-sm">⌥N</kbd>
            <span className="font-sans text-zinc-500 text-[10px]">Start New Line</span>
          </div>
        </div>
      </div>
    </div>
  )
}
