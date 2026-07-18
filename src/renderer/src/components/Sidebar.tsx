import React, { useEffect, useState } from 'react'

interface Notebook {
  id: string
  name: string
}

interface SidebarProps {
  activeNotebookId: string
  setActiveNotebookId: (id: string) => void
  onTriggerToast: (text: string, type?: 'success' | 'error' | 'info') => void
  onOpenSettings?: () => void
}

export default function Sidebar({
  activeNotebookId,
  setActiveNotebookId,
  onTriggerToast,
  onOpenSettings
}: SidebarProps): React.JSX.Element {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [newNotebookName, setNewNotebookName] = useState('')
  const [isAddingNotebook, setIsAddingNotebook] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [folderPath, setFolderPath] = useState<string>('Not Set')
  const [isCaptureActive, setIsCaptureActive] = useState<boolean>(true)

  useEffect(() => {
    fetchNotebooks()
    fetchFolderPath()

    // Fetch initial capture active state
    window.api.getSetting('capture_active', true).then((active) => {
      setIsCaptureActive(!!active)
    })

    // Listen for live updates from system tray menu
    const cleanup = window.api.onCaptureActiveChanged((_event, active: boolean) => {
      setIsCaptureActive(active)
    })

    return () => {
      cleanup()
    }
  }, [])

  const handleToggleCapture = async (): Promise<void> => {
    const nextVal = !isCaptureActive
    setIsCaptureActive(nextVal)
    await window.api.setSetting('capture_active', nextVal)
    onTriggerToast(
      `Capture ${nextVal ? 'Activated' : 'Deactivated'}`,
      nextVal ? 'success' : 'info'
    )
  }

  const fetchFolderPath = async (): Promise<void> => {
    try {
      const path = await window.api.getSetting('local_sync_folder_path', 'Not Set')
      setFolderPath(path)
    } catch (err) {
      console.error('Failed to load sync folder path:', err)
    }
  }

  const fetchNotebooks = async (): Promise<void> => {
    try {
      const list = await window.api.listNotebooks()
      setNotebooks(list)
      if (list.length > 0 && !activeNotebookId) {
        const defaultId = await window.api.getSetting('default_notebook_id', list[0].id)
        setActiveNotebookId(defaultId)
      }
    } catch (err) {
      console.error('Failed to load notebooks:', err)
    }
  }

  const handleAddNotebook = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newNotebookName.trim()) return

    try {
      const added = await window.api.createNotebook(newNotebookName.trim())
      setNotebooks((prev) => [...prev, added])
      setActiveNotebookId(added.id)
      setNewNotebookName('')
      setIsAddingNotebook(false)
      onTriggerToast('Notebook Created!', 'success')
    } catch (err) {
      console.error('Failed to create notebook:', err)
      onTriggerToast('Failed to create notebook', 'error')
    }
  }

  const handleDeleteNotebook = async (id: string, name: string): Promise<void> => {
    if (confirm(`Are you sure you want to delete the notebook "${name}"? All notes in this notebook will be deleted.`)) {
      try {
        await window.api.deleteNotebook(id)
        setNotebooks((prev) => prev.filter((nb) => nb.id !== id))
        if (activeNotebookId === id) setActiveNotebookId('default')
        onTriggerToast('Notebook Deleted', 'success')
      } catch (err) {
        console.error('Failed to delete notebook:', err)
        onTriggerToast('Failed to delete notebook', 'error')
      }
    }
  }

  const handleSetDefaultNotebook = async (id: string): Promise<void> => {
    setActiveNotebookId(id)
    await window.api.setSetting('default_notebook_id', id)
    onTriggerToast('Default Capture Notebook Set!', 'success')
  }

  return (
    <div className={`apple-sidebar ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex flex-col gap-2">
        {/* Title bar / Header logo */}
        <div className="sidebar-header titlebar-drag">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-blue-500/20">
                N
              </div>
              <span className="font-bold text-[13px] tracking-wide text-white font-sans">
                Smart Notes
              </span>
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="no-drag text-zinc-500 hover:text-zinc-350 p-1 hover:bg-white/5 rounded transition-all mx-auto cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 transform transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Notebooks List Section */}
        {!collapsed && (
          <div className="sidebar-content">
            <div className="flex items-center justify-between px-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <span>My Notebooks</span>
              <button
                onClick={() => setIsAddingNotebook(!isAddingNotebook)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Inline create notebook form */}
            {isAddingNotebook && (
              <form onSubmit={handleAddNotebook} className="flex gap-2 mt-1 animate-fade-in">
                <input
                  type="text"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="New name..."
                  className="flex-1 bg-zinc-900 border border-[#2d2d2f] text-xs rounded-lg px-3 py-2 outline-none text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50"
                  autoFocus
                />
                <button type="submit" className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-500 cursor-pointer transition-colors text-xs font-bold shadow-md shadow-blue-900/10">
                  Add
                </button>
              </form>
            )}

            <div className="notebook-list max-h-[400px] overflow-y-auto pr-1">
              {notebooks.map((nb) => {
                const isActive = activeNotebookId === nb.id
                return (
                  <div
                    key={nb.id}
                    onClick={() => handleSetDefaultNotebook(nb.id)}
                    className={`notebook-item ${isActive ? 'active' : 'inactive'}`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-350'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="truncate">{nb.name}</span>
                    </div>

                    {nb.id !== 'default' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNotebook(nb.id, nb.name)
                        }}
                        className={`opacity-0 group-hover:opacity-100 transition-all cursor-pointer ${
                          isActive ? 'text-blue-200 hover:text-white' : 'text-zinc-500 hover:text-rose-450'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Local Sync Status Bar Footer */}
      {!collapsed && (
        <div className="sidebar-footer">
          {/* Capture Active Toggle */}
          <div className="flex items-center justify-between border-b border-[#2d2d2f] pb-3 mb-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-zinc-350 font-sans tracking-wide">Capture Status</span>
              <span className="text-[10px] text-zinc-550 leading-normal font-sans">
                {isCaptureActive ? 'Shortcuts Active' : 'Shortcuts Off'}
              </span>
            </div>
            <label className="switch select-none no-drag">
              <input
                type="checkbox"
                checked={isCaptureActive}
                onChange={handleToggleCapture}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest font-sans">Local Sync</span>
            <button
              onClick={onOpenSettings}
              className="text-[10px] text-zinc-500 hover:text-blue-400 font-semibold transition-colors cursor-pointer"
              title="Open Settings"
            >
              Settings
            </button>
          </div>
          <div className="flex flex-col gap-1 text-zinc-350">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="font-semibold text-[10px] text-zinc-500 font-sans">Sync Folder:</span>
            </div>
            <span className="footer-path-box truncate" title={folderPath}>
              {folderPath}
            </span>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="py-5 border-t border-[#2d2d2f] flex flex-col gap-4 items-center">
          <span 
            onClick={handleToggleCapture}
            className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${isCaptureActive ? 'bg-blue-500 animate-pulse' : 'bg-zinc-650'}`}
            title={`Capture Status: ${isCaptureActive ? 'Active (ON) - Click to toggle' : 'Disabled (OFF) - Click to toggle'}`}
          ></span>
        </div>
      )}
    </div>
  )
}
