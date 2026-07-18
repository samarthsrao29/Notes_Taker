import React, { useState } from 'react'

interface OCRModalProps {
  onClose: () => void
  onNoteSaved: (msg: string) => void
}

export default function OCRModal({ onClose, onNoteSaved }: OCRModalProps): React.JSX.Element {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setImageSrc(reader.result as string)
        setOcrText('')
        setError(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePaste = (e: React.ClipboardEvent): void => {
    const item = e.clipboardData.items[0]
    if (item && item.type.indexOf('image') === 0) {
      const blob = item.getAsFile()
      if (blob) {
        const reader = new FileReader()
        reader.onload = () => {
          setImageSrc(reader.result as string)
          setOcrText('')
          setError(null)
        }
        reader.readAsDataURL(blob)
      }
    }
  }

  const triggerOCR = async (): Promise<void> => {
    if (!imageSrc) return
    setLoading(true)
    setError(null)

    try {
      // Send base64 image data url to Electron main process
      const text = await window.api.processOcr(imageSrc)
      if (text) {
        setOcrText(text)
      } else {
        setError('No text could be extracted from this image.')
      }
    } catch (err: any) {
      console.error('OCR Process failed:', err)
      setError(err.message || 'OCR extraction failed. Please try a different image.')
    } finally {
      setLoading(false)
    }
  }

  const saveOCRNote = async (format: 'paragraph' | 'quote' | 'important'): Promise<void> => {
    if (!ocrText.trim()) return

    try {
      const notebooks = await window.api.listNotebooks()
      const activeNotebookId = await window.api.getSetting('default_notebook_id', notebooks[0]?.id || 'default')

      let formatted = ''
      if (format === 'quote') {
        formatted = `<blockquote><p>${escapeHtml(ocrText)}</p></blockquote>`
      } else if (format === 'important') {
        formatted = `<div data-type="callout"><p>⚠️ <strong>Important:</strong> ${escapeHtml(ocrText)}</p></div>`
      } else {
        formatted = `<p>${escapeHtml(ocrText)}</p>`
      }

      const topic = ocrText.length > 40 ? ocrText.substring(0, 40) + '...' : ocrText

      await window.api.createNote({
        notebook_id: activeNotebookId,
        topic,
        content: formatted,
        plain_text: ocrText,
        source_type: 'ocr',
        source_name: 'OCR Scan'
      })

      onNoteSaved('OCR Text Captured!')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save OCR note')
    }
  }

  function escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden glass-panel">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="font-bold text-zinc-100">Local Book Scanner (OCR)</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
          
          {/* Left: Image Upload & Preview */}
          <div className="flex flex-col gap-4 border border-zinc-800/80 bg-zinc-900/10 rounded-xl p-4 flex-1 items-center justify-center relative min-h-[300px] glass-card">
            {imageSrc ? (
              <div className="w-full h-full flex flex-col justify-between items-center gap-4 relative">
                <img src={imageSrc} alt="Preview" className="max-h-[260px] object-contain rounded-lg border border-zinc-800" />
                
                <div className="flex gap-2">
                  <button
                    onClick={triggerOCR}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                    Run OCR Text Extract
                  </button>
                  <button
                    onClick={() => setImageSrc(null)}
                    disabled={loading}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    Clear Image
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-3 text-center p-6 w-full h-full justify-center">
                <svg className="w-12 h-12 text-zinc-600 group-hover:text-zinc-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-zinc-300 font-semibold text-sm">Upload Book Page or Image</div>
                <div className="text-zinc-500 text-xs mt-1">Drag and drop, browse, or press Command+V to paste a screenshot</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Right: OCR Output Text Box */}
          <div className="flex flex-col gap-4 border border-zinc-800/80 bg-zinc-900/10 rounded-xl p-4 glass-card min-h-[300px]">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Extracted OCR Text</h4>
            
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              placeholder={loading ? 'Processing OCR text extraction, please wait...' : 'Extracted text will appear here. You can manually edit it before saving.'}
              className="flex-1 bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-3 text-sm text-zinc-300 outline-none focus:border-purple-500/30 resize-none font-sans"
              disabled={loading}
            />

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => saveOCRNote('paragraph')}
                disabled={!ocrText.trim() || loading}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors"
              >
                Save as Paragraph
              </button>
              <button
                onClick={() => saveOCRNote('quote')}
                disabled={!ocrText.trim() || loading}
                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-medium text-xs px-3.5 py-2 rounded-lg transition-colors"
              >
                Save as Quote
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
