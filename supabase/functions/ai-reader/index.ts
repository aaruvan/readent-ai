import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIRequest {
  action: "summarize" | "analyze_pacing" | "industry_terms";
  text: string;
  industry?: "legal" | "medical" | "technical" | "general";
  options?: {
    summaryLength?: "brief" | "detailed";
  };
}

interface WordPacing {
  word: string;
  importance: number; // 0-1 scale, higher = more important = slower display
  isKeyTerm: boolean;
  semanticBoundary: boolean; // true = pause after this word
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

    const { action, text, industry = "general", options = {} } = await req.json() as AIRequest;

    if (!text || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "summarize":
        systemPrompt = getSummarizationPrompt(industry, options.summaryLength || "detailed");
        userPrompt = `Summarize the following text:\n\n${text}`;
        break;

      case "analyze_pacing":
        systemPrompt = getPacingAnalysisPrompt(industry);
        userPrompt = `Analyze the following text for smart pacing. Return a JSON array of word objects with importance scores and semantic boundaries:\n\n${text}`;
        break;

      case "industry_terms":
        systemPrompt = getIndustryTermsPrompt(industry);
        userPrompt = `Identify and explain key ${industry} terms in the following text:\n\n${text}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch("https://api.keywordsai.co/api/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KEYWORDS_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: action === "analyze_pacing" ? 4000 : 2000,
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

    // Parse response based on action
    let result: unknown;
    
    if (action === "analyze_pacing") {
      try {
        // Extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]) as WordPacing[];
        } else {
          result = content;
        }
      } catch {
        result = content;
      }
    } else {
      result = content;
    }

    return new Response(
      JSON.stringify({ result, action }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI Reader error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getSummarizationPrompt(industry: string, length: string): string {
  const industryContext = {
    legal: "You are a legal document specialist. Preserve key legal terms, case citations, and statutory references. Highlight obligations, rights, and deadlines.",
    medical: "You are a medical document specialist. Preserve medical terminology accurately, highlight diagnoses, treatments, and critical clinical information.",
    technical: "You are a technical documentation specialist. Preserve technical terms, specifications, and procedural steps accurately.",
    general: "You are a professional summarization assistant.",
  };

  const lengthGuide = length === "brief" 
    ? "Create a very concise summary in 2-3 sentences capturing only the most essential points."
    : "Create a comprehensive summary that captures all key points, main arguments, and important details. Use bullet points for clarity.";

  return `${industryContext[industry as keyof typeof industryContext] || industryContext.general}

${lengthGuide}

Guidelines:
- Maintain accuracy of specialized terminology
- Highlight critical information
- Preserve the original meaning and intent
- Structure the summary for easy speed reading`;
}

function getPacingAnalysisPrompt(industry: string): string {
  const industryTerms = {
    legal: "legal terms like 'plaintiff', 'defendant', 'jurisdiction', 'liability', 'negligence', 'breach', 'damages', 'statute', 'precedent'",
    medical: "medical terms like diagnoses, medications, procedures, anatomical terms, dosages, contraindications",
    technical: "technical terms like specifications, protocols, algorithms, configurations, parameters",
    general: "specialized vocabulary and proper nouns",
  };

  return `You are a reading pace optimization assistant. Analyze text to identify:
1. Important concepts that need slower reading (higher importance score)
2. Key ${industryTerms[industry as keyof typeof industryTerms] || industryTerms.general}
3. Semantic boundaries where readers should pause briefly

Return a JSON array where each element has:
- "word": the word
- "importance": number 0-1 (1 = very important, needs more time)
- "isKeyTerm": boolean (true for domain-specific terms)
- "semanticBoundary": boolean (true if pause needed after this word)

Rules for importance scoring:
- Long/complex words: +0.2
- Domain-specific terms: +0.3
- End of sentence: +0.2
- Numbers/dates: +0.2
- Names/proper nouns: +0.15
- Common words (the, a, is, etc.): 0.0-0.1

Return ONLY the JSON array, no other text.`;
}

function getIndustryTermsPrompt(industry: string): string {
  return `You are a ${industry} terminology expert. Identify and briefly explain specialized terms in the text.

Return a JSON object with:
{
  "terms": [
    {
      "term": "the term",
      "definition": "brief definition",
      "context": "how it's used in this text"
    }
  ],
  "readingTips": "brief advice for reading this ${industry} content"
}

Keep definitions concise but accurate. Focus on terms a general reader might not know.`;
}
