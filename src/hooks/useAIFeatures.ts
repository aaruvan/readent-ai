import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IndustryMode = 'general' | 'legal' | 'medical' | 'technical';

interface WordPacing {
  word: string;
  importance: number;
  isKeyTerm: boolean;
  semanticBoundary: boolean;
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
  pacingData: WordPacing[] | null;
  industryTerms: IndustryTermsResult | null;
  
  // Actions
  summarizeText: (text: string, industry?: IndustryMode, length?: 'brief' | 'detailed') => Promise<string | null>;
  analyzePacing: (text: string, industry?: IndustryMode) => Promise<WordPacing[] | null>;
  getIndustryTerms: (text: string, industry: IndustryMode) => Promise<IndustryTermsResult | null>;
  clearResults: () => void;
}

export const useAIFeatures = (): UseAIFeaturesReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
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
    industry: IndustryMode = 'general',
    length: 'brief' | 'detailed' = 'detailed'
  ): Promise<string | null> => {
    const result = await callAIFunction('summarize', text, industry, { summaryLength: length });
    if (result) {
      setSummary(result);
    }
    return result;
  }, [callAIFunction]);

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
    setPacingData(null);
    setIndustryTerms(null);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    summary,
    pacingData,
    industryTerms,
    summarizeText,
    analyzePacing,
    getIndustryTerms,
    clearResults,
  };
};
