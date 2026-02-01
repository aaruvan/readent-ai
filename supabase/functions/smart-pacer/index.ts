/**
 * Smart Pacer Edge Function
 * Splits long text into ~100-word segments at sentence boundaries, calls Keywords AI
 * for each segment in parallel, merges results, returns one response to the client.
 * Output: [{ chunk, multiplier }] — multiplier 0.5–2.0 applied to base delay.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmartPacerRequest {
  text: string;
  user_wpm: number;
  comprehension?: "skim" | "normal" | "deep";
  goal?: "maintain" | "improve";
}

interface DisplayUnit {
  chunk: string;
  multiplier: number;
}

const PROMPT_ID = "3d599ae814694279a38a70329c3a87a9";
const SEGMENT_MAX_WORDS = 100;

/** Clean text before LLM: normalize whitespace, remove invisible chars, strip emojis. */
function cleanText(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\r\n|\r/g, "\n")
    .replace(/[\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSegments(text: string, maxWords: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [trimmed];
  const segments: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const sent of sentences) {
    const words = sent.split(/\s+/).filter(Boolean).length;
    if (currentWords + words > maxWords && current.length > 0) {
      segments.push(current.join(" "));
      current = [sent];
      currentWords = words;
    } else {
      current.push(sent);
      currentWords += words;
    }
  }
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
}

async function fetchSegmentPacing(
  apiKey: string,
  segmentText: string,
  user_wpm: number,
  comprehension: string,
  goal: string
): Promise<DisplayUnit[]> {
  const response = await fetch("https://api.keywordsai.co/api/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        prompt_id: PROMPT_ID,
        variables: {
          selected_text: segmentText,
          user_wpm: String(user_wpm),
          comprehension,
          goal,
        },
      },
      customer_identifier: "swift_insight_reader",
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Keywords AI error:", response.status, errorText);
    let errMsg = "AI service error";
    try {
      const errJson = JSON.parse(errorText);
      errMsg = errJson.error?.message || errJson.message || errJson.error || errorText.slice(0, 200);
    } catch {
      if (errorText) errMsg = errorText.slice(0, 200);
    }
    const err = new Error(errMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from AI");
  return parsePacerResponse(content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KEYWORDS_AI_API_KEY = Deno.env.get("KEYWORDS_AI_API_KEY");
    if (!KEYWORDS_AI_API_KEY) {
      throw new Error("KEYWORDS_AI_API_KEY is not configured");
    }

    const body = (await req.json()) as SmartPacerRequest;
    const { text, user_wpm = 300, comprehension = "normal", goal = "maintain" } = body;

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleaned = cleanText(text);
    if (!cleaned) {
      return new Response(
        JSON.stringify({ error: "Text is empty after cleaning" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const segments = splitIntoSegments(cleaned, SEGMENT_MAX_WORDS);
    const resultsArrays = await Promise.all(
      segments.map((seg) =>
        fetchSegmentPacing(KEYWORDS_AI_API_KEY, seg, user_wpm, comprehension, goal)
      )
    );
    const result = resultsArrays.flat();

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smart Pacer error:", error);
    const err = error as Error & { status?: number };
    const errMsg = err.message || "Unknown error";
    if (err.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: err.status && err.status >= 400 ? err.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parsePacerResponse(content: string): DisplayUnit[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    let arr: unknown[] = [];
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "items" in parsed &&
      Array.isArray((parsed as { items: unknown }).items)
    ) {
      arr = (parsed as { items: unknown[] }).items;
    }
    return arr
      .map((item) => {
        if (item && typeof item === "object" && "multiplier" in item) {
          const chunk =
            "chunk" in item
              ? String((item as { chunk: unknown }).chunk)
              : "word" in item
                ? String((item as { word: unknown }).word)
                : "";
          if (!chunk || !chunk.trim()) return null;
          let m = Number((item as { multiplier: unknown }).multiplier);
          m = Number.isFinite(m) ? Math.max(0.5, Math.min(2, m)) : 1;
          return { chunk: chunk.trim(), multiplier: m };
        }
        return null;
      })
      .filter((x): x is DisplayUnit => x !== null);
  } catch {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as unknown[];
        return parsed
          .map((item) => {
            if (item && typeof item === "object" && "multiplier" in item) {
              const chunk =
                "chunk" in item
                  ? String((item as { chunk: unknown }).chunk)
                  : "word" in item
                    ? String((item as { word: unknown }).word)
                    : "";
              if (!chunk || !chunk.trim()) return null;
              let m = Number((item as { multiplier: unknown }).multiplier);
              m = Number.isFinite(m) ? Math.max(0.5, Math.min(2, m)) : 1;
              return { chunk: chunk.trim(), multiplier: m };
            }
            return null;
          })
          .filter((x): x is DisplayUnit => x !== null);
      } catch {
        return [];
      }
    }
    return [];
  }
}
