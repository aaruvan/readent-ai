# Swift Insight Reader

Browser extension + web app for attention‑aware speed reading with AI summarizing.
Note: please use the extension for the full experience; eye tracking on the web app is beta.

Repo: https://github.com/aaruvan/readent-ai

Quick shortcut: press `Option + R` (macOS) or `Alt + R` (Windows/Linux) to open Readent.

## Prerequisites

- Node.js 18+
- npm
- A Chromium browser (Chrome, Edge, Brave)
- Supabase project (for Edge Functions)
- Keywords AI account (for AI summarizing/pacing)

## 1) Install dependencies

```sh
npm install
```

## 2) Configure environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

These are used by the web app and by the extension UI that calls the web app and Supabase.

## 3) Configure Supabase secrets (Keywords AI)

The AI features call Keywords AI from Supabase Edge Functions. Add the API key as a Supabase secret:

- `KEYWORDS_AI_API_KEY` — your Keywords AI API key

You can set this in the Supabase dashboard:

Project Settings → Functions → Secrets → Add secret.

## 4) Run the web app (eye tracking)

```sh
npm run dev
```

Open the URL printed in the terminal. When enabling eye tracking, allow camera access.

## 5) Load the Chrome extension (step by step)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `extension` folder in this repo.
5. Open any article, select text, then click the extension icon to start reading.

## Features to explore

- Eye tracking pause/rewind in the web app
- Adaptive pacing and AI summarization via Keywords AI
- Context‑aware chunked reading

## Repo layout

- `extension/` — Chrome extension source
- `src/` — web app
- `supabase/functions/` — Edge Functions (AI summarizing and smart pacing)
