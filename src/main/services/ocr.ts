import Tesseract from 'tesseract.js'
import { dbOps } from './database'

export async function performOCR(imagePathOrBuffer: string | Buffer): Promise<string> {
  dbOps.logStatEvent('ocr')

  const { data: { text } } = await Tesseract.recognize(
    imagePathOrBuffer,
    'eng',
    {
      logger: (progress) => {
        if (progress.status === 'recognizing text') {
          console.log(`OCR Progress: ${(progress.progress * 100).toFixed(0)}%`)
        }
      }
    }
  )

  return text.trim()
}
