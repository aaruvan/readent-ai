# Swift Insight Reader – Chrome Extension

Chrome extension (Manifest V3) that turns selected text on any webpage into an RSVP speed reader overlay: words appear one at a time with ORP highlight, adaptive pacing, and keyboard shortcuts.

## Features

- **Seamless flow**: Select text → press **Alt+R** (Option+R on Mac) → reader opens. No need to open the popup.
- **Right-click**: Right-click selected text → "Speed Read Selection" for quick access.
- **Selection preview**: Popup shows selected text preview and word count when opened.
- **ORP highlight**: Optimal Recognition Point (orange focal character) for faster recognition.
- **Adaptive pacing**: Slower on long words, punctuation, numbers, capitals; faster on short words.
- **AI Smart Pacer**: Click the 🧠 button to analyze text with AI for per-word pacing (requires deployed `smart-pacer` edge function).
- **Controls**: WPM slider (50–1200), words-at-a-time (1–5), font size, play/pause, skip, restart.
- **Persistent WPM**: Default WPM saved and synced across devices.
- **Keyboard**: Alt+R (open reader), Alt+Space (play/pause when reader open), Space, ←/→, ↑/↓, R, Escape.

## Install (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose the `extension` folder (this directory).

## Usage

1. On any webpage, select the text you want to speed read.
2. Either:
   - Press **Alt+R** (Option+R on Mac) — fastest: select → press key,
   - Right-click → **Speed Read Selection**, or
   - Click the extension icon and click **Start Reading**.
3. The overlay opens. Press **Space** to start; use the controls or keyboard as needed.
4. (Optional) Click **Smart** (🧠) to enable AI pacing — the extension calls the `smart-pacer` Supabase edge function.
5. Press **Escape** or click **Close** to dismiss.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+R (Option+R on Mac) | Toggle reader — open with selection, or close if already open |
| Alt+Space | Play/Pause (when reader is open) |
| Space | Play/Pause |
| ← → | Skip backward/forward |
| ↑ ↓ | Increase/decrease WPM |
| R | Restart |
| Escape | Close reader |

## Files

| File | Role |
|------|------|
| `manifest.json` | Manifest V3: permissions, content script, popup, background, commands, context menu. |
| `background.js` | Service worker: context menu, keyboard commands, injects content script when needed. |
| `content.js` | Selection, overlay injection, RSVP logic (ORP + adaptive pacing + keyboard). |
| `content.css` | Overlay styles (dark theme, controls, word display). |
| `popup/` | Popup UI: selection preview, word count, Start Reading button, WPM setting, shortcuts. |

## AI Smart Pacer

Requires the `smart-pacer` Supabase edge function to be deployed. See `../supabase/functions/smart-pacer/` for setup. The extension uses `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `content.js` — update these if using a different project.
