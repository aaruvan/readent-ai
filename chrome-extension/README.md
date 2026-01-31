# RSVP Speed Reader Chrome Extension

A Chrome extension for speed reading any selected text using RSVP (Rapid Serial Visual Presentation).

## Features

- **ORP Highlighting**: Highlights the Optimal Recognition Point of each word (≈30% into the word) for faster visual processing
- **Adaptive Pacing**: Automatically adjusts timing based on word length, punctuation, and complexity
- **Keyboard Shortcuts**: Full keyboard control for hands-free reading
- **Persistent Settings**: Remembers your WPM and font size preferences
- **Translucent Overlay**: Non-intrusive reading overlay that works on any webpage

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension icon should appear in your toolbar

### Create Icons

Before publishing, create icon files in the `icons/` folder:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Usage

### Method 1: Context Menu
1. Select text on any webpage
2. Right-click the selection
3. Click "Speed Read Selection"

### Method 2: Popup
1. Select text on any webpage
2. Click the extension icon in your toolbar
3. Click "Start Reading"

### Method 3: Keyboard Shortcut
1. Select text on any webpage
2. Press `Alt + R` to open the reader

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Skip backward |
| `→` | Skip forward |
| `↑` | Increase speed |
| `↓` | Decrease speed |
| `R` | Stop/Reset |
| `Esc` | Close reader |
| `Alt + R` | Toggle reader (global) |
| `Alt + Space` | Play/Pause (global) |

## How It Works

### ORP (Optimal Recognition Point)
The extension highlights a single character in each word at approximately 30% of the word length. This focal point helps your eyes lock onto the optimal position for word recognition, reducing saccadic eye movement and increasing reading speed.

### Adaptive Pacing
Words are displayed for variable amounts of time based on:
- **Word length**: Longer words get more time
- **Punctuation**: End-of-sentence punctuation adds a pause
- **Numbers**: Numerical content gets extra processing time
- **Capitalization**: Proper nouns and acronyms get a slight pause

## Files

```
chrome-extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for context menu & commands
├── content.js         # Main reader logic & overlay injection
├── content.css        # Overlay styles
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── popup.css          # Popup styles
├── icons/             # Extension icons (create these)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## Permissions

- `activeTab`: Access the current tab to get selected text
- `storage`: Save user preferences (WPM, font size)
- `contextMenus`: Add "Speed Read Selection" to right-click menu
