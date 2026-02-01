import { useState, useCallback, useRef, useEffect } from 'react';

interface RSVPSettings {
  wpm: number;
  wordsAtATime: number;
  fontSize: number;
}

interface WordPacing {
  word: string;
  importance: number;
  isKeyTerm: boolean;
  semanticBoundary: boolean;
}

interface UseRSVPReaderReturn {
  words: string[];
  currentIndex: number;
  currentWord: string;
  isPlaying: boolean;
  progress: number;
  settings: RSVPSettings;
  estimatedTimeLeft: string;
  totalTime: string;
  pacingData: WordPacing[] | null;
  speedMultiplier: number;
  setText: (text: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlay: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  goToPosition: (index: number) => void;
  setWPM: (wpm: number) => void;
  setWordsAtATime: (count: number) => void;
  setFontSize: (size: number) => void;
  setPacingData: (data: WordPacing[] | null) => void;
  setSpeedMultiplier: (multiplier: number) => void;
}

const DEFAULT_SETTINGS: RSVPSettings = {
  wpm: 300,
  wordsAtATime: 1,
  fontSize: 48,
};

// Calculate delay based on word characteristics for adaptive pacing
const calculateWordDelay = (
  word: string, 
  baseDelay: number,
  pacingInfo?: WordPacing
): number => {
  let multiplier = 1;
  
  // If we have AI pacing data, use it
  if (pacingInfo) {
    // importance is 0-1, convert to delay multiplier (1.0-2.0)
    multiplier += pacingInfo.importance;
    
    // Add pause at semantic boundaries
    if (pacingInfo.semanticBoundary) {
      multiplier += 0.3;
    }
    
    // Key terms get extra time
    if (pacingInfo.isKeyTerm) {
      multiplier += 0.2;
    }
    
    return baseDelay * multiplier;
  }
  
  // Fallback to heuristic-based pacing
  // Longer words need more time
  if (word.length > 8) multiplier += 0.3;
  if (word.length > 12) multiplier += 0.2;
  
  // Punctuation pauses
  if (/[.!?]$/.test(word)) multiplier += 0.5; // End of sentence
  if (/[,;:]$/.test(word)) multiplier += 0.25; // Minor pause
  
  // Numbers need more processing time
  if (/\d/.test(word)) multiplier += 0.2;
  
  // Capitalized words (names, proper nouns)
  if (/^[A-Z]/.test(word) && word.length > 1) multiplier += 0.1;
  
  return baseDelay * multiplier;
};

/** Clean text: normalize whitespace, remove invisible chars, strip emojis. */
const cleanText = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/[\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

export const useRSVPReader = (): UseRSVPReaderReturn => {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState<RSVPSettings>(DEFAULT_SETTINGS);
  const [pacingData, setPacingData] = useState<WordPacing[] | null>(null);
  const [speedMultiplier, setSpeedMultiplierState] = useState(1);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordsRef = useRef<string[]>(words);
  const indexRef = useRef(currentIndex);
  const settingsRef = useRef(settings);
  const pacingDataRef = useRef(pacingData);
  const speedMultiplierRef = useRef(speedMultiplier);

  // Keep refs in sync
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    pacingDataRef.current = pacingData;
  }, [pacingData]);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  const scheduleNextWord = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const currentWords = wordsRef.current;
    const index = indexRef.current;
    const currentSettings = settingsRef.current;
    const currentPacing = pacingDataRef.current;
    const currentMultiplier = speedMultiplierRef.current;

    if (index >= currentWords.length) {
      setIsPlaying(false);
      return;
    }

    // Get the words for this display
    const displayWords = currentWords.slice(index, index + currentSettings.wordsAtATime);
    const combinedWord = displayWords.join(' ');
    
    // Get pacing info for the first word in the group
    const pacingInfo = currentPacing?.[index];
    
    const baseDelay = (60 / currentSettings.wpm) * 1000 * currentSettings.wordsAtATime;
    const rawDelay = calculateWordDelay(combinedWord, baseDelay, pacingInfo);
    const safeMultiplier = Math.max(0.1, currentMultiplier);
    const delay = rawDelay / safeMultiplier;

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = prev + currentSettings.wordsAtATime;
        indexRef.current = next;
        if (next < currentWords.length) {
          scheduleNextWord();
        } else {
          setIsPlaying(false);
        }
        return next;
      });
    }, delay);
  }, []);

  const play = useCallback(() => {
    if (words.length === 0) return;
    if (currentIndex >= words.length) {
      setCurrentIndex(0);
      indexRef.current = 0;
    }
    setIsPlaying(true);
    scheduleNextWord();
  }, [words.length, currentIndex, scheduleNextWord]);

  const pause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentIndex(0);
    indexRef.current = 0;
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const skipForward = useCallback(() => {
    const skip = Math.max(10, Math.floor(words.length * 0.05));
    const newIndex = Math.min(currentIndex + skip, words.length - 1);
    setCurrentIndex(newIndex);
    indexRef.current = newIndex;
    if (isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNextWord();
    }
  }, [words.length, currentIndex, isPlaying, scheduleNextWord]);

  const skipBackward = useCallback(() => {
    const skip = Math.max(10, Math.floor(words.length * 0.05));
    const newIndex = Math.max(currentIndex - skip, 0);
    setCurrentIndex(newIndex);
    indexRef.current = newIndex;
    if (isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNextWord();
    }
  }, [words.length, currentIndex, isPlaying, scheduleNextWord]);

  const goToPosition = useCallback((index: number) => {
    const newIndex = Math.max(0, Math.min(index, words.length - 1));
    setCurrentIndex(newIndex);
    indexRef.current = newIndex;
    if (isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNextWord();
    }
  }, [words.length, isPlaying, scheduleNextWord]);

  const setText = useCallback((text: string) => {
    const cleaned = cleanText(text);
    const parsed = cleaned
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWords(parsed);
    wordsRef.current = parsed;
    setCurrentIndex(0);
    indexRef.current = 0;
    setIsPlaying(false);
    setPacingData(null); // Clear pacing data when text changes
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setWPM = useCallback((wpm: number) => {
    setSettings((prev) => ({ ...prev, wpm: Math.max(50, Math.min(1500, wpm)) }));
  }, []);

  const setWordsAtATime = useCallback((count: number) => {
    setSettings((prev) => ({ ...prev, wordsAtATime: Math.max(1, Math.min(5, count)) }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setSettings((prev) => ({ ...prev, fontSize: Math.max(16, Math.min(120, size)) }));
  }, []);

  const setSpeedMultiplier = useCallback((multiplier: number) => {
    setSpeedMultiplierState(Math.max(0.1, Math.min(1.5, multiplier)));
  }, []);

  // Calculate current word(s) to display
  const currentWord = words.length > 0
    ? words.slice(currentIndex, currentIndex + settings.wordsAtATime).join(' ')
    : '';

  // Calculate progress
  const progress = words.length > 0 ? (currentIndex / words.length) * 100 : 0;

  // Calculate time estimates
  const wordsRemaining = Math.max(0, words.length - currentIndex);
  const secondsRemaining = (wordsRemaining / settings.wpm) * 60;
  const totalSeconds = (words.length / settings.wpm) * 60;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    words,
    currentIndex,
    currentWord,
    isPlaying,
    progress,
    settings,
    pacingData,
    speedMultiplier,
    estimatedTimeLeft: formatTime(secondsRemaining),
    totalTime: formatTime(totalSeconds),
    setText,
    play,
    pause,
    stop,
    togglePlay,
    skipForward,
    skipBackward,
    goToPosition,
    setWPM,
    setWordsAtATime,
    setFontSize,
    setPacingData,
    setSpeedMultiplier,
  };
};
