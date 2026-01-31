import { useState, useCallback, useRef, useEffect } from 'react';

interface RSVPSettings {
  wpm: number;
  wordsAtATime: number;
  fontSize: number;
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
}

const DEFAULT_SETTINGS: RSVPSettings = {
  wpm: 300,
  wordsAtATime: 1,
  fontSize: 48,
};

// Calculate delay based on word characteristics for adaptive pacing
const calculateWordDelay = (word: string, baseDelay: number): number => {
  let multiplier = 1;
  
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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wordsRef = useRef<string[]>(words);
  const indexRef = useRef(currentIndex);
  const settingsRef = useRef(settings);

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

  const getBaseDelay = useCallback(() => {
    return (60 / settings.wpm) * 1000 * settings.wordsAtATime;
  }, [settings.wpm, settings.wordsAtATime]);

  const scheduleNextWord = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const currentWords = wordsRef.current;
    const index = indexRef.current;
    const currentSettings = settingsRef.current;

    if (index >= currentWords.length) {
      setIsPlaying(false);
      return;
    }

    // Get the words for this display
    const displayWords = currentWords.slice(index, index + currentSettings.wordsAtATime);
    const combinedWord = displayWords.join(' ');
    
    const baseDelay = (60 / currentSettings.wpm) * 1000 * currentSettings.wordsAtATime;
    const delay = calculateWordDelay(combinedWord, baseDelay);

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
    const parsed = text
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWords(parsed);
    wordsRef.current = parsed;
    setCurrentIndex(0);
    indexRef.current = 0;
    setIsPlaying(false);
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
  };
};

