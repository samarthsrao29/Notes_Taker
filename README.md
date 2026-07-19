# smart-notes

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Production Preview

```bash
$ npm run start
```

### Build

```bash
# Build & package options
npm run build         # Check types & build production assets
npm run build:mac     # Package for macOS (.dmg/.app)
npm run build:win     # Package for Windows (.exe)
npm run build:linux   # Package for Linux
npm run build:unpack  # Package in local directory for testing
```

---

## Keyboard Shortcuts

The application registers global keyboard shortcuts for capturing text and saving it directly to your notebooks.

### Active Text Capture Shortcuts

| Action / Style | Default Hotkey | Output Format / Markup |
| :--- | :--- | :--- |
| **Heading 1** | `Cmd` / `Ctrl` + `T` | `<h1>Captured Text</h1>` |
| **Heading 2** | `Cmd` / `Ctrl` + `Shift` + `T` | `<h2>Captured Text</h2>` |
| **Heading 3** | `Cmd` / `Ctrl` + `Shift` + `3` | `<h3>Captured Text</h3>` |
| **Paragraph** | `Cmd` / `Ctrl` + `N` | Standard `<p>` paragraph |
| **Bullet List** | `Cmd` / `Ctrl` + `B` | Bullet point `<ul><li>` |
| **Quote** | `Cmd` / `Ctrl` + `Q` | `<blockquote>` |
| **Definition** | `Cmd` / `Ctrl` + `D` | `<p><strong>Definition:</strong> Captured Text</p>` |
| **Important** | `Cmd` / `Ctrl` + `I` | Callout block with a ⚠️ icon |
| **Checklist** | `Cmd` / `Ctrl` + `L` | Task list checkbox item |

### Continuation Shortcuts
Always active for appending newly copied text to the last note selection:

* **Same-line continuation (`Alt + S`):** Appends selection on the same line as the last note.
* **Next-line continuation (`Alt + N`):** Appends selection on the next line below the last note.

### AI & Utility Shortcuts (Temporarily Disabled)
*These shortcuts are defined but currently bypassed in the code:*
* **AI Summary:** `Cmd` / `Ctrl` + `S`
* **AI Explain:** `Cmd` / `Ctrl` + `E`
* **AI Flashcards:** `Cmd` / `Ctrl` + `F`
* **Auto-Tag:** `Cmd` / `Ctrl` + `M`

---

## Performance & Background Footprint

This application is designed to run in the system tray in the background with minimal performance overhead:

- **Idle Performance (0% CPU):** Global keyboard shortcuts are registered directly with the OS event loop. The app does not run background busy-loops to listen for key presses.
- **Sync Overhead (<1ms CPU usage):** The sync engine queries the SQLite database every 30 seconds (default). These queries complete in under a millisecond when idle.
- **Resource Usage during Capturing:** Capturing frontmost window data (via AppleScript) takes a fraction of a second when triggered.
- **Heavy Tasks:** AI operations are executed in the cloud via remote Gemini API calls, keeping local CPU usage zero. Heavy OCR operations (Tesseract) run purely on-demand, not in the background.
