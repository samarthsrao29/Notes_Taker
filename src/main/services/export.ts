import { BrowserWindow } from 'electron'
import { Note } from './database'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import fs from 'fs'

export function formatNoteAsMarkdown(note: Note): string {
  const dateStr = new Date(note.created_at).toLocaleString()
  let md = `# ${note.topic}\n\n`
  
  if (note.source_name) {
    md += `**Source:** ${note.source_name}\n`
    if (note.source_title) md += `**Title:** ${note.source_title}\n`
    if (note.source_url) md += `**URL:** [Link](${note.source_url})\n`
    md += `**Captured:** ${dateStr}\n\n`
  }

  md += `## Note Highlight\n\n${note.plain_text}\n`
  return md
}

export function formatNoteAsPlainText(note: Note): string {
  const dateStr = new Date(note.created_at).toLocaleString()
  let text = `=== ${note.topic} ===\n`
  if (note.source_name) {
    text += `Source: ${note.source_name}\n`
    if (note.source_title) text += `Title: ${note.source_title}\n`
    if (note.source_url) text += `URL: ${note.source_url}\n`
    text += `Captured: ${dateStr}\n`
  }
  text += `\n${note.plain_text}\n`
  return text
}

export async function exportToDocx(note: Note, outputPath: string): Promise<void> {
  const dateStr = new Date(note.created_at).toLocaleString()
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: note.topic,
            heading: HeadingLevel.HEADING_1
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Source: ${note.source_name || 'Manual'}`, italics: true }),
              new TextRun({ text: ` | Title: ${note.source_title || 'Untitled'}`, italics: true }),
              new TextRun({ text: ` | Captured: ${dateStr}`, italics: true })
            ]
          }),
          new Paragraph({ text: '' }), // Spacer
          new Paragraph({
            children: [
              new TextRun({ text: note.plain_text })
            ]
          })
        ]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

// Exports note using a hidden BrowserWindow to print to PDF
export function exportToPdf(note: Note, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dateStr = new Date(note.created_at).toLocaleString()
    
    // Construct HTML template for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #111;
              line-height: 1.6;
            }
            h1 {
              font-size: 24px;
              color: #2b2b2b;
              margin-bottom: 5px;
              border-bottom: 2px solid #eaeaea;
              padding-bottom: 10px;
            }
            .metadata {
              font-size: 11px;
              color: #666;
              margin-bottom: 25px;
              font-style: italic;
            }
            .content {
              font-size: 14px;
              color: #333;
              white-space: pre-wrap;
              background-color: #fcfcfc;
              border-left: 4px solid #7c3aed;
              padding: 15px;
              border-radius: 4px;
            }
            .source-url {
              word-break: break-all;
              color: #4f46e5;
            }
          </style>
        </head>
        <body>
          <h1>${note.topic}</h1>
          <div class="metadata">
            <strong>Source:</strong> ${note.source_name || 'Manual'} <br/>
            <strong>Title:</strong> ${note.source_title || 'Untitled'} <br/>
            ${note.source_url ? `<strong>URL:</strong> <span class="source-url">${note.source_url}</span> <br/>` : ''}
            <strong>Captured:</strong> ${dateStr}
          </div>
          <div class="content">${note.plain_text}</div>
        </body>
      </html>
    `

    // Create a hidden print window
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false
      }
    })

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

    printWin.webContents.on('did-finish-load', async () => {
      try {
        const pdfData = await printWin.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          }
        })
        fs.writeFileSync(outputPath, pdfData)
        printWin.destroy()
        resolve()
      } catch (err) {
        printWin.destroy()
        reject(err)
      }
    })
  })
}
