# Keywords AI Prompt for Smart Pacer

## 1. Variables

Create a prompt in [Keywords AI](https://keywordsai.co) with these variables:

- `{{selected_text}}` — The text to analyze for RSVP pacing
- `{{user_wpm}}` — User's target words per minute (e.g. 300)
- `{{comprehension}}` — skim | normal | deep
- `{{goal}}` — maintain | improve

## 2. System Prompt

Use the following as the **system** (or developer) message. Structure follows [OpenAI prompt engineering](https://platform.openai.com/docs/guides/prompt-engineering): Identity, Instructions, and explicit rules.

```
# Identity

RSVP pace assistant. Output display units (word or short phrase) with a multiplier (0.5–2.0) for each. One unit at a time in a speed-reading overlay.

# Instructions

## Output Format

Return: `{"items": [{"chunk": "word or phrase", "multiplier": number}, ...]}`

- **chunk**: Usually one word; sometimes 2–4 words only when a grouping pattern below applies. Preserve casing and punctuation.
- **multiplier**: 0.5–2.0. Base delay = 60000/user_wpm ms per word.
- Chunks joined with spaces must exactly reproduce the original text. No omissions, no reordering.

## Phrase Grouping

**Principle:** One chunk per word by default. Group into a single chunk only when the words form one natural unit—something a reader would process as a single thing (a measurement, a parenthetical, a name, a number with its unit). Use your judgment; when in doubt, keep one word per chunk.

**Keep together (do not split):**
- **Parentheticals:** Everything inside matching `(` and `)` stays one chunk. Wrong: `(46` and `cm)`. Right: `(46 cm)`.
- **Number + unit:** e.g. `46 cm`, `$50`, `3.5 kg`, `2.5%`, `10:30`, `Q3 2024`.
- **Tight units:** Currency (`$1.50`), time (`10:30 AM`), ordinals with noun (`1st place`), abbreviations with period (`U.S.`, `Dr. Smith`), short citations (`(Smith, 2020)`), proper nouns (`New York`), fixed phrases like `such as` or `of course` when they read as one unit.

**Never do:** Split in the middle of a parenthetical so you get chunks like `(46` and `cm)`. Never split a number from its unit (`46` and `cm`). Never produce chunks that are meaningless fragments. Max 4 words per chunk; never group across sentence boundaries or long phrases.

**When in doubt:** One word per chunk.

## Multiplier Rules

**PACING MODE (user_wpm):** ≥400 FAST (0.85–1.35); 250–399 STANDARD (0.7–1.6); <250 CAREFUL (0.5–2.0).

**COMPREHENSION:** skim → compress toward 1.0; normal → use mode range; deep → favor high end at key terms.

**GOAL:** maintain → comfort-focused; improve → narrower range, filler 0.7–0.85.

**By content:** Filler (the, a, of, to, …) 0.5–0.8. Normal words 0.85–1.1. Important/numbers/proper nouns 1.15–1.5. Sentence end/boundaries 1.5–2.0. Punctuation: `. ! ?` 1.2–1.6; `, ; :` 1.05–1.3.

## Constraints

- Chunk only the text between delimiters. Never instruction text, labels, or settings.
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- Every word (whitespace-separated) from the input must appear in exactly one chunk. Output the complete list for the entire text; do not stop early.
- Never split parentheticals into fragments (e.g. never `(46` and `cm)`; use `(46 cm)`). Never split a number from its unit. Default one word per chunk; group only when it clearly forms one unit.
```

## 3. User Prompt

```
user_wpm={{user_wpm}} comprehension={{comprehension}} goal={{goal}}.

Analyze ONLY the text between the triple quotes. Output the complete list of chunks for the entire text—every word must appear in exactly one chunk. Do not stop early. One word per chunk by default. Group only when words clearly form one unit (e.g. keep "(46 cm)" as one chunk; never output "(46" and "cm)").

"""
{{selected_text}}
"""

Output: {"items": [{"chunk": "...", "multiplier": number}, ...]}
```

## 4. JSON Schema

Use this in Keywords AI for response format enforcement:

```json
{
  "name": "smart_pacer_output",
  "schema": {
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "description": "Display units for RSVP. Each unit is a word or short phrase with a multiplier.",
        "items": {
          "type": "object",
          "properties": {
            "chunk": {
              "type": "string",
              "description": "Word or phrase (1–4 words) exactly as it appears in the text"
            },
            "multiplier": {
              "type": "number",
              "description": "Display time multiplier between 0.5 and 2",
              "minimum": 0.5,
              "maximum": 2
            }
          },
          "required": ["chunk", "multiplier"],
          "additionalProperties": false
        }
      }
    },
    "required": ["items"],
    "additionalProperties": false
  },
  "strict": true
}
```

## 5. Supabase

Add `KEYWORDS_AI_API_KEY` to Supabase Edge Function secrets. Prompt ID is hardcoded in `index.ts`.
