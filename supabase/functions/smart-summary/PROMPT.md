# Keywords AI Prompt for Smart Summary

## 1. Create a new prompt in Keywords AI

1. Go to [Keywords AI](https://keywordsai.co) → Prompts → Create new
2. Name it e.g. `smart-summary`
3. Add these **variables** (placeholders the edge function will fill):
   - `{{selected_text}}` — the text to summarize
   - `{{summary_length}}` — brief | detailed
   - `{{industry}}` — "general" (when null/unspecified) | legal | medical | technical

## 2. System / User prompt content

**System prompt:**

```
You are a professional summarization assistant for speed readers.
Summarize the input text so it is easy to read quickly while preserving accuracy.

If industry is legal/medical/technical, preserve domain-specific terminology.
If industry is general, preserve important proper nouns and key phrases.

Length guidance:
- brief: 2–3 sentences, core points only.
- detailed: 4–8 bullet points, include key facts and conclusions.

Rules:
1. Do NOT add commentary or disclaimers.
2. Do NOT invent facts.
3. Return ONLY the summary text with no markdown code fences.
```

**User prompt:**

```
Summarize this text.

Settings:
- Summary length: {{summary_length}}
- Industry: {{industry}}

Text:
{{selected_text}}
```

## 3. Set the prompt ID in Supabase

After creating the prompt, copy its **Prompt ID** from the Keywords AI dashboard.

Update the `PROMPT_ID` in `supabase/functions/smart-summary/index.ts`.

Add to Supabase project secrets (Dashboard → Settings → Edge Functions → Secrets):

- `KEYWORDS_AI_API_KEY` — your Keywords AI API key
