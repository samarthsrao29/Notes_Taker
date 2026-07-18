import React, { useEffect, useState } from 'react'

interface ShortcutConfig {
  h1: string
  h2: string
  h3: string
  paragraph: string
  bullet: string
  quote: string
  definition: string
  important: string
  checklist: string
  aiSummary: string
  aiExplain: string
  aiFlashcards: string
  addTags: string
}

export default function Settings(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('gemini-1.5-flash')
  const [theme, setTheme] = useState('dark')
  
  // Local Sync Folder Config
  const [localSyncPath, setLocalSyncPath] = useState('')

  // Sync / Duplicate Preferences
  const [syncInterval, setSyncInterval] = useState(30)
  const [duplicateWindow, setDuplicateWindow] = useState(5)
  const [duplicateBehavior, setDuplicateBehavior] = useState<'notify' | 'ignore'>('notify')

  // Shortcuts settings
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async (): Promise<void> => {
    try {
      const savedKey = await window.api.getSetting('gemini_api_key', '')
      const savedModel = await window.api.getSetting('gemini_model_name', 'gemini-1.5-flash')
      const savedTheme = await window.api.getSetting('app_theme', 'dark')
      
      const syncFolder = await window.api.getSetting('local_sync_folder_path', '')

      const savedSyncInterval = await window.api.getSetting('sync_interval_seconds', 30)
      const savedDupWindow = await window.api.getSetting('duplicate_detection_window', 5000)
      const savedDupBehavior = await window.api.getSetting('duplicate_detection_behavior', 'notify')

      const savedShortcuts = await window.api.getSetting('shortcuts_config', {
        h1: 'CommandOrControl+T',
        h2: 'CommandOrControl+Shift+T',
        h3: 'CommandOrControl+Shift+3',
        paragraph: 'CommandOrControl+N',
        bullet: 'CommandOrControl+B',
        quote: 'CommandOrControl+Q',
        definition: 'CommandOrControl+D',
        important: 'CommandOrControl+I',
        checklist: 'CommandOrControl+L',
        aiSummary: 'CommandOrControl+S',
        aiExplain: 'CommandOrControl+E',
        aiFlashcards: 'CommandOrControl+F',
        addTags: 'CommandOrControl+M'
      })

      setApiKey(savedKey)
      setModelName(savedModel)
      setTheme(savedTheme)
      setLocalSyncPath(syncFolder)
      setSyncInterval(savedSyncInterval)
      setDuplicateWindow(savedDupWindow / 1000)
      setDuplicateBehavior(savedDupBehavior as 'notify' | 'ignore')
      setShortcuts(savedShortcuts)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const saveSettingItem = async (key: string, value: any): Promise<void> => {
    await window.api.setSetting(key, value)
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setApiKey(val)
    saveSettingItem('gemini_api_key', val)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value
    setModelName(val)
    saveSettingItem('gemini_model_name', val)
  }

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value
    setTheme(val)
    saveSettingItem('app_theme', val)

    // Toggle stylesheet theme classes
    if (val === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
  }

  const handleSyncIntervalChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseInt(e.target.value, 10)
    setSyncInterval(val)
    saveSettingItem('sync_interval_seconds', val)
  }

  const handleDuplicateWindowChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseInt(e.target.value, 10)
    setDuplicateWindow(val)
    saveSettingItem('duplicate_detection_window', val * 1000)
  }

  const handleDuplicateBehaviorChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value as 'notify' | 'ignore'
    setDuplicateBehavior(val)
    saveSettingItem('duplicate_detection_behavior', val)
  }

  const handleShortcutChange = (key: keyof ShortcutConfig, val: string): void => {
    if (!shortcuts) return
    const updated = { ...shortcuts, [key]: val }
    setShortcuts(updated)
    saveSettingItem('shortcuts_config', updated)
  }

  const handleSelectFolder = async (): Promise<void> => {
    try {
      const folder = await window.api.selectLocalFolder()
      if (folder) {
        setLocalSyncPath(folder)
        await saveSettingItem('local_sync_folder_path', folder)
      }
    } catch (err: any) {
      console.error(err)
      alert(`Failed to select directory: ${err.message}`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 text-zinc-100 flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
          Settings & Preferences
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Configure shortcuts, synchronization, themes, and AI features</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: General, AI, Google Sync */}
        <div className="flex flex-col gap-6">
          
          {/* General & Theme Card */}
          <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-5 glass-card flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/80 pb-2">General Customizations</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Interface Color Theme</label>
              <select
                value={theme}
                onChange={handleThemeChange}
                className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2 text-zinc-300"
              >
                <option value="dark">Slate Dark Mode (Default)</option>
                <option value="light">Paper Light Mode</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Duplicate Capture Prevent Window (Seconds)</label>
              <input
                type="number"
                value={duplicateWindow}
                onChange={handleDuplicateWindowChange}
                className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2 text-zinc-300"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Duplicate Capture Filter Behavior</label>
              <select
                value={duplicateBehavior}
                onChange={handleDuplicateBehaviorChange}
                className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2 text-zinc-300"
              >
                <option value="notify">Notify user & save (Toast alert)</option>
                <option value="ignore">Ignore duplicate captures silently</option>
              </select>
            </div>
          </div>

          {/* AI Configuration Card */}
          <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-5 glass-card flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/80 pb-2">Gemini AI Configuration</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Gemini API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter Google AI API Key..."
                className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2.5 text-zinc-200 placeholder-zinc-600"
              />
              <span className="text-[10px] text-zinc-500">Your key is stored locally in SQLite settings.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Recommended Model</label>
              <select
                value={modelName}
                onChange={handleModelChange}
                className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2 text-zinc-300"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Instant & Light)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Analytical)</option>
              </select>
            </div>
          </div>

          {/* Local Folder Sync Card */}
          <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-5 glass-card flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/80 pb-2">Local Sync Directory</h3>
            
            <div className="flex flex-col gap-2.5">
              <label className="text-xs text-zinc-400 font-medium">Selected Directory</label>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1.5">
                {localSyncPath ? (
                  <span className="text-xs text-zinc-300 font-mono break-all">📁 {localSyncPath}</span>
                ) : (
                  <span className="text-xs text-zinc-550 italic">No directory chosen. Sync is disabled.</span>
                )}
              </div>
              <button
                onClick={handleSelectFolder}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg border border-zinc-700 self-start transition-colors mt-1"
              >
                Change Sync Folder...
              </button>
            </div>

            <div className="flex flex-col gap-1.5 mt-2 border-t border-zinc-800/60 pt-3">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Background Sync Frequency</span>
                <span className="font-semibold text-purple-400">{syncInterval}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={syncInterval}
                onChange={handleSyncIntervalChange}
                className="w-full h-1 bg-zinc-800 accent-purple-500 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Global Keyboard Shortcuts Customizer */}
        <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-5 glass-card flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/80 pb-2">Global Keyboard Shortcuts</h3>
          <p className="text-[10px] text-zinc-500 -mt-2 leading-relaxed">
            Format: Use Electron accelerator naming (e.g. <code>CommandOrControl+T</code>, <code>CommandOrControl+Shift+3</code>). Shortcuts bind natively to the OS.
          </p>

          {shortcuts ? (
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              {[
                { label: 'Save Selection as Heading 1', key: 'h1' },
                { label: 'Save Selection as Heading 2', key: 'h2' },
                { label: 'Save Selection as Heading 3', key: 'h3' },
                { label: 'Save Selection as Paragraph', key: 'paragraph' },
                { label: 'Save Selection as Bullet Point', key: 'bullet' },
                { label: 'Save Selection as Blockquote', key: 'quote' },
                { label: 'Save Selection as Definition Block', key: 'definition' },
                { label: 'Save Selection as Important Note', key: 'important' },
                { label: 'Save Selection as Checklist Item', key: 'checklist' },
                { label: 'AI Summary (Create Note)', key: 'aiSummary' },
                { label: 'AI Explain Simply (Create Note)', key: 'aiExplain' },
                { label: 'AI Flashcards (Create Note)', key: 'aiFlashcards' },
                { label: 'AI Suggest Tags', key: 'addTags' }
              ].map((shortcutItem) => (
                <div key={shortcutItem.key} className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-400 font-medium">{shortcutItem.label}</span>
                  <input
                    type="text"
                    value={shortcuts[shortcutItem.key]}
                    onChange={(e) => handleShortcutChange(shortcutItem.key as keyof ShortcutConfig, e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 outline-none text-xs rounded-lg p-2 text-zinc-300 font-mono focus:border-purple-500/30"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Loading shortcuts...</div>
          )}
        </div>

      </div>
    </div>
  )
}
