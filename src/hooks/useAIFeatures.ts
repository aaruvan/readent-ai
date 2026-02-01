import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IndustryMode = 'general' | 'legal' | 'medical' | 'technical';

interface WordPacing {
  word: string;
  importance: number;
  isKeyTerm: boolean;
  semanticBoundary: boolean;
}

interface SummaryHighlight {
  phrase: string;
  score: number;
}

interface SummaryMeta {
  source_word_count_est?: number;
  target_summary_words?: number;
  summary_length?: 'brief' | 'detailed';
}

interface SummaryResult {
  summary: string;
  highlights: SummaryHighlight[];
  meta?: SummaryMeta;
}

interface IndustryTerm {
  term: string;
  definition: string;
  context: string;
}

interface IndustryTermsResult {
  terms: IndustryTerm[];
  readingTips: string;
}

interface UseAIFeaturesReturn {
  // State
  isLoading: boolean;
  error: string | null;
  summary: string | null;
  summaryHighlights: SummaryHighlight[];
  summaryMeta: SummaryMeta | null;
  pacingData: WordPacing[] | null;
  industryTerms: IndustryTermsResult | null;
  
  // Actions
  summarizeText: (text: string, length?: 'brief' | 'detailed') => Promise<SummaryResult | null>;
  analyzePacing: (text: string, industry?: IndustryMode) => Promise<WordPacing[] | null>;
  getIndustryTerms: (text: string, industry: IndustryMode) => Promise<IndustryTermsResult | null>;
  clearResults: () => void;
}

export const useAIFeatures = (): UseAIFeaturesReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryHighlights, setSummaryHighlights] = useState<SummaryHighlight[]>([]);
  const [summaryMeta, setSummaryMeta] = useState<SummaryMeta | null>(null);
  const [pacingData, setPacingData] = useState<WordPacing[] | null>(null);
  const [industryTerms, setIndustryTerms] = useState<IndustryTermsResult | null>(null);

  const callAIFunction = useCallback(async (
    action: 'summarize' | 'analyze_pacing' | 'industry_terms',
    text: string,
    industry: IndustryMode = 'general',
    options: Record<string, unknown> = {}
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-reader', {
        body: { action, text, industry, options },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI request failed';
      setError(errorMessage);
      console.error('AI Feature error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const summarizeText = useCallback(async (
    text: string,
    length: 'brief' | 'detailed' = 'detailed'
  ): Promise<SummaryResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('smart-summary', {
        body: { text, summary_length: length },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const rawResult = data?.result;
      let summaryText = '';
      let highlights: SummaryHighlight[] = [];
      let meta: SummaryMeta | undefined = undefined;

      if (rawResult && typeof rawResult === 'object') {
        const obj = rawResult as Record<string, unknown>;
        summaryText = String(obj.summary || obj.text || '').trim();
        if (Array.isArray(obj.highlights)) highlights = obj.highlights as SummaryHighlight[];
        if (obj.meta && typeof obj.meta === 'object') meta = obj.meta as SummaryMeta;
      } else if (typeof rawResult === 'string') {
        const trimmed = rawResult.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            summaryText = String(parsed.summary || parsed.text || '').trim();
            if (Array.isArray(parsed.highlights)) highlights = parsed.highlights as SummaryHighlight[];
            if (parsed.meta && typeof parsed.meta === 'object') meta = parsed.meta as SummaryMeta;
          } catch {
            summaryText = trimmed;
          }
        } else {
          summaryText = trimmed;
        }
      }

      if (!summaryText) {
        throw new Error('Summary was empty');
      }

      setSummary(summaryText);
      setSummaryHighlights(highlights);
      setSummaryMeta(meta || null);
      return { summary: summaryText, highlights, meta };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI request failed';
      setError(errorMessage);
      console.error('AI Feature error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzePacing = useCallback(async (
    text: string,
    industry: IndustryMode = 'general'
  ): Promise<WordPacing[] | null> => {
    const result = await callAIFunction('analyze_pacing', text, industry);
    if (result && Array.isArray(result)) {
      setPacingData(result);
      return result;
    }
    return null;
  }, [callAIFunction]);

  const getIndustryTerms = useCallback(async (
    text: string,
    industry: IndustryMode
  ): Promise<IndustryTermsResult | null> => {
    const result = await callAIFunction('industry_terms', text, industry);
    if (result) {
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result;
        setIndustryTerms(parsed);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  }, [callAIFunction]);

  const clearResults = useCallback(() => {
    setSummary(null);
    setSummaryHighlights([]);
    setSummaryMeta(null);
    setPacingData(null);
    setIndustryTerms(null);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    summary,
    summaryHighlights,
    summaryMeta,
    pacingData,
    industryTerms,
    summarizeText,
    analyzePacing,
    getIndustryTerms,
    clearResults,
  };
};
