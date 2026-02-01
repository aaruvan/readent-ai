/**
 * Smart Pacer Edge Function
 * Calls Keywords AI to get per-word display multipliers for RSVP speed reading.
 * Output: [{ word, multiplier }] — multiplier 0.5–2.0 applied to base delay (60000/user_wpm).
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
  industry?: string | null;
  comprehension?: "skim" | "normal" | "deep";
  goal?: "maintain" | "improve";
}

const VALID_INDUSTRIES = ["legal", "medical", "technical"] as const;

interface WordMultiplier {
  word: string;
  multiplier: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KEYWORDS_AI_API_KEY = Deno.env.get("KEYWORDS_AI_API_KEY");
    const PROMPT_ID = Deno.env.get("KEYWORDS_AI_SMART_PACER_PROMPT_ID");

    if (!KEYWORDS_AI_API_KEY) {
      throw new Error("KEYWORDS_AI_API_KEY is not configured");
    }
    if (!PROMPT_ID) {
      throw new Error("KEYWORDS_AI_SMART_PACER_PROMPT_ID is not configured");
    }

    const body = (await req.json()) as SmartPacerRequest;
    const { text, user_wpm = 300, comprehension = "normal", goal = "maintain" } = body;
    const industry = body.industry && VALID_INDUSTRIES.includes(body.industry as typeof VALID_INDUSTRIES[number]) ? body.industry : "general";

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.keywordsai.co/api/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEYWORDS_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "placeholder" }],
        temperature: 0.2,
        max_tokens: 8000,
        extra_body: {
          prompt: {
            prompt_id: PROMPT_ID,
            variables: {
              selected_text: text,
              user_wpm: String(user_wpm),
              industry,
              comprehension,
              goal,
            },
            override: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Keywords AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = parsePacerResponse(content);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smart Pacer error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parsePacerResponse(content: string): WordMultiplier[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    return parsed.map((item) => {
      if (item && typeof item === "object" && "word" in item && "multiplier" in item) {
        let m = Number((item as { multiplier: unknown }).multiplier);
        m = Number.isFinite(m) ? Math.max(0.5, Math.min(2, m)) : 1;
        return {
          word: String((item as { word: unknown }).word),
          multiplier: m,
        };
      }
      return null;
    }).filter((x): x is WordMultiplier => x !== null);
  } catch {
    return [];
  }
}
