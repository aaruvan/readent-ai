/**
 * Smart Summary Edge Function
 * Calls Keywords AI to summarize text before RSVP reading.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface SmartSummaryRequest {
  text: string;
  summary_length?: "brief" | "detailed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const KEYWORDS_AI_API_KEY = Deno.env.get("KEYWORDS_AI_API_KEY");
    const PROMPT_ID = "85bc5f0a67dc4281b7eefbcdc8eb1665";

    if (!KEYWORDS_AI_API_KEY) {
      throw new Error("KEYWORDS_AI_API_KEY is not configured");
    }

    const body = (await req.json()) as SmartSummaryRequest;
    const { text } = body;
    const summaryLength = body.summary_length === "brief" ? "brief" : "detailed";

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
        prompt: {
          prompt_id: PROMPT_ID,
          variables: {
            selected_text: text,
            summary_length: summaryLength,
          },
        },
        customer_identifier: "swift_insight_reader",
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    let result: unknown = content.trim();
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        if (parsed && typeof parsed === "object") {
          result = parsed;
        }
      }
    } catch {
      // Fall back to raw content
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smart Summary error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
