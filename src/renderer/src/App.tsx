import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import LocalDashboard from './components/LocalDashboard'
import Toast, { ToastMessage } from './components/Toast'

function App(): React.JSX.Element {
  const [activeNotebookId, setActiveNotebookId] = useState<string>('default')
  
  // Toast overlays
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Onboarding & Local Sync states
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [localSyncPath, setLocalSyncPath] = useState<string>('')
  
  // Settings modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsGeminiKey, setSettingsGeminiKey] = useState('')
  const [settingsLocalSyncPath, setSettingsLocalSyncPath] = useState('')

  // Load settings for modal when opened
  useEffect(() => {
    if (isSettingsOpen) {
      window.api.getSetting('gemini_api_key', '').then(setSettingsGeminiKey)
      window.api.getSetting('local_sync_folder_path', '').then(setSettingsLocalSyncPath)
    }
  }, [isSettingsOpen])

  const handleSaveSettings = async (): Promise<void> => {
    try {
      await window.api.setSetting('gemini_api_key', settingsGeminiKey.trim())
      await window.api.setSetting('local_sync_folder_path', settingsLocalSyncPath.trim())
      
      triggerToast('✓ Settings saved successfully!', 'success')
      setIsSettingsOpen(false)
      // Force reload directory details
      if (settingsLocalSyncPath.trim()) {
        setLocalSyncPath(settingsLocalSyncPath.trim())
      }
    } catch (err: any) {
      console.error(err)
      triggerToast(`Failed to save settings: ${err.message}`, 'error')
    }
  }

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success'): void => {
    const id = Math.random().toString()
    setToasts((prev) => [...prev, { id, text, type }])
  }

  const checkLocalOnboarding = async (): Promise<void> => {
    try {
      const syncFolder = await window.api.getSetting<string | null>('local_sync_folder_path', null)
      const setupDone = await window.api.getSetting('google_onboarding_complete', false)
      setOnboardingComplete(setupDone && !!syncFolder)
      if (syncFolder) {
        setLocalSyncPath(syncFolder)
      }
    } catch (err) {
      console.error('Failed to check onboarding status:', err)
    } finally {
      setLoadingAuth(false)
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    try {
      const folder = await window.api.selectLocalFolder()
      if (folder) {
        setLocalSyncPath(folder)
      }
    } catch (err: any) {
      console.error(err)
      triggerToast(`Failed to select folder: ${err.message}`, 'error')
    }
  }

  const handleFinishOnboarding = async (): Promise<void> => {
    if (!localSyncPath) {
      triggerToast('Please select a local sync directory.', 'error')
      return
    }

    try {
      await window.api.setSetting('local_sync_folder_path', localSyncPath)
      await window.api.setSetting('google_onboarding_complete', true)

      setOnboardingComplete(true)
      triggerToast('✓ Setup complete! Enjoy Smart Notes.', 'success')
    } catch (err) {
      console.error(err)
      triggerToast('Failed to save onboarding settings.', 'error')
    }
  }

  // Check onboarding status on boot
  useEffect(() => {
    checkLocalOnboarding()
  }, [])



  // Hook global keyboard shortcuts capture and AI triggers from Main process
  useEffect(() => {
    // 1. Capture started (scanning animation/toast)
    const cleanupStarted = window.api.onCaptureStarted(() => {
      triggerToast('Capturing highlight...', 'info')
    })

    // 2. Note captured successfully
    const cleanupCaptured = window.api.onNoteCaptured((_event, res: any) => {
      if (res.success && res.note) {
        triggerToast(`✓ ${res.message}`, 'success')
      } else {
        triggerToast(`Capture Failed: ${res.message}`, 'error')
      }
    })

    // 3. Trigger AI capture directly from global hotkey
    const cleanupAiCapture = window.api.onTriggerAiCapture(async (_event, data: any) => {
      triggerToast(`AI ${data.type.toUpperCase()} Capturing...`, 'info')
      try {
        // Run selection capture
        const captureResult = await window.api.triggerCapture('paragraph')
        if (captureResult.success && captureResult.note) {
          const noteObj = captureResult.note
          
          let aiText = ''
          if (data.type === 'summary') {
            aiText = await window.api.aiSummary(noteObj.plain_text)
            await window.api.updateNote(noteObj.id, {
              content: `<div data-type="callout"><p>✨ <strong>AI Summary:</strong> ${aiText}</p></div><br/>${noteObj.content}`
            })
            triggerToast('✓ AI Summary Note Saved!', 'success')
          } else if (data.type === 'explain') {
            aiText = await window.api.aiExplain(noteObj.plain_text)
            await window.api.updateNote(noteObj.id, {
              content: `<div data-type="callout"><p>💡 <strong>Simple Explanation:</strong> ${aiText}</p></div><br/>${noteObj.content}`
            })
            triggerToast('✓ AI Explanation Saved!', 'success')
          } else if (data.type === 'flashcards') {
            const cards = await window.api.aiFlashcards(noteObj.plain_text)
            for (const c of cards) {
              await window.api.createFlashcard(noteObj.id, c.question, c.answer)
            }
            triggerToast(`✓ Generated ${cards.length} Flashcards!`, 'success')
          } else if (data.type === 'autotags') {
            const tags = await window.api.aiAutotags(noteObj.plain_text)
            for (const t of tags) {
              await window.api.addTagToNote(noteObj.id, t)
            }
            triggerToast(`✓ Auto-tagged: ${tags.join(', ')}`, 'success')
          }
        } else {
          triggerToast('AI Capture: No text found.', 'error')
        }
      } catch (err: any) {
        console.error('AI global trigger failed:', err)
        let friendlyMsg = err.message || 'AI trigger failed'
        friendlyMsg = friendlyMsg.replace(/^Error occurred in handler for '[^']+':\s*/i, '')
        triggerToast(friendlyMsg, 'error')
      }
    })

    // Apply saved theme on boot
    window.api.getSetting('app_theme', 'dark').then((savedTheme) => {
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme')
      } else {
        document.body.classList.remove('light-theme')
      }
    })

    return () => {
      cleanupStarted()
      cleanupCaptured()
      cleanupAiCapture()
    }
  }, [activeNotebookId])

  if (loadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-500 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs">Initializing Smart Notes...</span>
        </div>
      </div>
    )
  }

  if (!onboardingComplete) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 font-sans p-6 text-zinc-200 select-none">
        <div className="w-full max-w-lg bg-[#161617] border border-[#2d2d2f] rounded-2xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm text-white shadow-md shadow-blue-500/20">
              N
            </div>
            <h1 className="text-lg font-bold text-white">
              Smart Notes Onboarding
            </h1>
          </div>

          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-[#2d2d2f] pb-2">
                Configure Local Storage
              </h2>
              <p className="text-xs text-zinc-550 leading-relaxed mt-1 font-sans">
                Smart Notes keeps your notes completely local. Choose a directory on your machine where we will automatically export and sync your highlights as plain text (.txt) files.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-[#2d2d2f] pt-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sync Directory</label>
              
              <div className="flex flex-col gap-2 bg-zinc-950/40 border border-[#2d2d2f] rounded-xl p-3.5">
                {localSyncPath ? (
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Selected Folder:</span>
                    <span className="text-xs text-zinc-300 font-mono break-all leading-normal">📁 {localSyncPath}</span>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-650 italic">No sync folder selected yet.</span>
                )}
              </div>

              <button
                onClick={handleSelectFolder}
                className="bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-xl border border-[#2d2d2f] transition-all w-full flex items-center justify-center gap-2 mt-1.5 cursor-pointer"
              >
                Choose Local Sync Folder
              </button>
            </div>

            <button
              onClick={handleFinishOnboarding}
              disabled={!localSyncPath}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/20 mt-4 cursor-pointer"
            >
              Finish Setup & Start Capturing
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans select-none">
      
      {/* 1. Sidebar Nav */}
      <Sidebar
        activeNotebookId={activeNotebookId}
        setActiveNotebookId={setActiveNotebookId}
        onTriggerToast={triggerToast}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Workspace View Selector */}
      <LocalDashboard
        localSyncPath={localSyncPath}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerToast={triggerToast}
      />

      {/* 3. Toast Notifications */}
      <Toast toasts={toasts} setToasts={setToasts} />

      {/* 4. Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 font-sans p-6 select-none animate-fade-in">
          <div className="w-full max-w-md bg-[#161617] border border-[#2d2d2f] rounded-2xl p-6 flex flex-col gap-5 shadow-2xl relative overflow-hidden text-zinc-200">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-[#2d2d2f] pb-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Application Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-500 hover:text-zinc-350 transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Section 1: Gemini API */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans">Gemini AI Integration</label>
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-500 font-semibold">Gemini API Key</label>
                <input
                  type="password"
                  value={settingsGeminiKey}
                  onChange={(e) => setSettingsGeminiKey(e.target.value)}
                  placeholder="Paste your Gemini API key..."
                  className="bg-zinc-900 border border-[#2d2d2f] focus:border-blue-500/50 outline-none rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 font-mono transition-colors"
                />
              </div>
              <p className="text-[10px] text-zinc-550 leading-normal text-left">
                Required to run auto-tagging, summaries, definitions, and quizzes on captured textbook selections.
              </p>
            </div>

            {/* Section 2: Local Sync Folder */}
            <div className="flex flex-col gap-2.5 border-t border-[#2d2d2f] pt-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans">Note Sync Directory</label>
              <div className="flex flex-col gap-2 text-left">
                <div className="bg-zinc-950/60 border border-[#2d2d2f] rounded-xl p-3.5 flex flex-col gap-1">
                  {settingsLocalSyncPath ? (
                    <span className="text-xs text-zinc-300 font-mono break-all leading-normal">📁 {settingsLocalSyncPath}</span>
                  ) : (
                    <span className="text-xs text-zinc-650 italic">No sync folder selected.</span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const folder = await window.api.selectLocalFolder()
                    if (folder) {
                      setSettingsLocalSyncPath(folder)
                    }
                  }}
                  className="bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-[#2d2d2f] text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all self-start mt-1 cursor-pointer"
                >
                  Choose Folder...
                </button>
              </div>
            </div>

             {/* Actions */}
             <div className="flex justify-end gap-3 border-t border-[#2d2d2f] pt-4">
               <button
                 onClick={() => setIsSettingsOpen(false)}
                 className="bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-[#2d2d2f] text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
               >
                 Cancel
               </button>
               <button
                 onClick={handleSaveSettings}
                 className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md shadow-blue-900/10 transition-all cursor-pointer"
               >
                 Save Settings
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
