# Swift Insight Reader

Minimal speed-reading system with a web app and a browser extension.

## Prerequisites

- Node.js 18+
- npm
- A Chromium browser (Chrome, Edge, Brave)

## Web app (with eye tracking)

1. Install dependencies:
   ```sh
   npm install
   ```
2. Create a `.env` file if needed and add Supabase keys used by the app.
3. Start the dev server:
   ```sh
   npm run dev
   ```
4. Open the app at the URL printed in the terminal.
5. When enabling eye tracking, allow camera access in the browser.

## Browser extension

1. Build the web app if you plan to point the extension to local content:
   ```sh
   npm run dev
   ```
2. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the `extension` folder in this repo
3. Open any article, select text, and use the extension popup to start reading.

## Development notes

- Extension source is in `extension/`
- Web app source is in `src/`
- Supabase functions live in `supabase/functions/`

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
