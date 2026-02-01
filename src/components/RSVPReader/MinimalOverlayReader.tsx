import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Pause, Play, Eye, EyeOff } from 'lucide-react';
import { useRSVPReader } from '@/hooks/useRSVPReader';
import { useEyeTracking, calculateRewindPosition } from '@/hooks/useEyeTracking';
import { Button } from '@/components/ui/button';

interface MinimalOverlayReaderProps {
  text: string;
  onClose: () => void;
  wordsAtATime?: number;
}

const pickFocusIndex = (chunk: string): number => {
  const center = Math.floor(chunk.length / 2);
  const isValid = (char: string) => /[a-zA-Z0-9]/.test(char);

  for (let offset = 0; offset <= chunk.length; offset += 1) {
    const left = center - offset;
    const right = center + offset;
    if (left >= 0 && isValid(chunk[left])) return left;
    if (right < chunk.length && isValid(chunk[right])) return right;
  }

  return Math.max(0, Math.min(chunk.length - 1, center));
};

export const MinimalOverlayReader = ({
  text,
  onClose,
  wordsAtATime = 3,
}: MinimalOverlayReaderProps) => {
  const {
    words,
    currentIndex,
    currentWord,
    isPlaying,
    settings,
    setText,
    setWordsAtATime,
    setWPM,
    play,
    pause,
    goToPosition,
    setSpeedMultiplier,
  } = useRSVPReader();

  const [eyeTrackingEnabled] = useState(true);
  const [rampUpMultiplier, setRampUpMultiplier] = useState(1);
  const [rewindNotice, setRewindNotice] = useState<number | null>(null);
  const [rewindOverlay, setRewindOverlay] = useState(false);
  const wasPlayingBeforeAwayRef = useRef(false);
  const lastIndexRef = useRef(0);
  const pendingRewindRef = useRef(false);
  const pendingRewindWordsRef = useRef(10);
  const autoStartRef = useRef(false);
  const rampIntervalRef = useRef<number | null>(null);

  const { isLookingAway, startTracking, stopTracking } = useEyeTracking({
    onLookAway: () => {
      if (!eyeTrackingEnabled) return;
      lastIndexRef.current = currentIndex;
      wasPlayingBeforeAwayRef.current = isPlaying;
      pendingRewindRef.current = true;
      pendingRewindWordsRef.current = 10;
      if (isPlaying) pause();
    },
    onLookBack: () => {
      if (!eyeTrackingEnabled) return;
      if (!pendingRewindRef.current) return;
      pendingRewindRef.current = false;
      const rewindWords = pendingRewindWordsRef.current || 10;
      const baseIndex = lastIndexRef.current ?? currentIndex;
      const { newIndex, rampUpSpeed } = calculateRewindPosition(baseIndex, rewindWords, words.length);
      goToPosition(newIndex);
      setRampUpMultiplier(rampUpSpeed);
      setRewindNotice(rewindWords);
      setRewindOverlay(true);

      const rampInterval = window.setInterval(() => {
        setRampUpMultiplier((prev) => {
          if (prev >= 1) {
            window.clearInterval(rampInterval);
            return 1;
          }
          return prev + 0.1;
        });
      }, 450);

      if (wasPlayingBeforeAwayRef.current) {
        play();
      }
    },
    lossMs: 800,
    recoverMs: 250,
    minFaceAreaRatio: 0.02,
  });

  useEffect(() => {
    setText(text);
    setWordsAtATime(wordsAtATime);
    autoStartRef.current = false;
  }, [text, wordsAtATime, setText, setWordsAtATime]);

  useEffect(() => {
    if (autoStartRef.current) return;
    if (words.length === 0) return;
    setWPM(500);
    setRampUpMultiplier(0.2);
    if (rampIntervalRef.current) {
      window.clearInterval(rampIntervalRef.current);
    }
    rampIntervalRef.current = window.setInterval(() => {
      setRampUpMultiplier((prev) => {
        if (prev >= 1) {
          if (rampIntervalRef.current) {
            window.clearInterval(rampIntervalRef.current);
            rampIntervalRef.current = null;
          }
          return 1;
        }
        return prev + 0.08;
      });
    }, 180);
    play();
    autoStartRef.current = true;
  }, [words.length, play, setWPM]);

  useEffect(() => {
    if (eyeTrackingEnabled) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [eyeTrackingEnabled, startTracking, stopTracking]);

  useEffect(() => {
    if (isLookingAway && isPlaying) {
      pause();
    }
  }, [isLookingAway, isPlaying, pause]);

  useEffect(() => {
    setSpeedMultiplier(rampUpMultiplier);
  }, [rampUpMultiplier, setSpeedMultiplier]);

  useEffect(() => {
    lastIndexRef.current = currentIndex;
  }, [currentIndex]);

  const { before, focal, after } = useMemo(() => {
    if (!currentWord) return { before: '', focal: '', after: '' };
    const focusIndex = pickFocusIndex(currentWord);
    return {
      before: currentWord.slice(0, focusIndex),
      focal: currentWord[focusIndex] || '',
      after: currentWord.slice(focusIndex + 1),
    };
  }, [currentWord]);

  const contextBefore = useMemo(() => {
    const start = Math.max(0, currentIndex - 12);
    return words.slice(start, currentIndex).join(' ');
  }, [words, currentIndex]);

  const contextAfter = useMemo(() => {
    const start = currentIndex + settings.wordsAtATime;
    const end = Math.min(words.length, start + 12);
    return words.slice(start, end).join(' ');
  }, [words, currentIndex, settings.wordsAtATime]);

  useEffect(() => {
    if (rewindNotice === null) return;
    const timeout = window.setTimeout(() => setRewindNotice(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [rewindNotice]);

  useEffect(() => {
    if (!rewindOverlay) return;
    const timeout = window.setTimeout(() => setRewindOverlay(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [rewindOverlay]);

  useEffect(() => {
    return () => {
      if (rampIntervalRef.current) {
        window.clearInterval(rampIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xl">
      <div className="w-full max-w-6xl px-8">
        <div className="mx-auto rounded-3xl border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between px-6 pt-5 pb-3 text-xs uppercase tracking-[0.35em] text-white/60">
            <span className="flex items-center gap-2 tracking-[0.25em]">
              {isLookingAway ? <EyeOff className="h-4 w-4 text-destructive" /> : <Eye className="h-4 w-4 text-white/70" />}
              {isLookingAway ? 'Paused' : 'Active'}
            </span>
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-8 pb-14 pt-6 text-center">
            <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 px-6 py-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
              {(isLookingAway || rewindOverlay) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-white">
                  <div className="rounded-full border border-white/10 bg-black/60 px-5 py-2 text-xs uppercase tracking-[0.25em]">
                    {isLookingAway ? 'Look back to resume' : 'Rewound'}
                  </div>
                </div>
              )}
              <div className="relative mx-auto max-w-4xl">
                <p className="mb-8 text-base md:text-lg leading-relaxed text-white/55">{contextBefore}</p>
                <div className="flex items-center justify-center">
                  <span className="font-reader text-2xl md:text-3xl font-semibold tracking-wide text-white/90 transition-all duration-200 ease-out">
                    {before}
                    <span className="text-primary drop-shadow-[0_0_24px_rgba(255,0,106,0.5)]">{focal}</span>
                    {after}
                  </span>
                </div>
                <p className="mt-8 text-base md:text-lg leading-relaxed text-white/55">{contextAfter}</p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 text-xs text-white/50">
              <button
                onClick={isPlaying ? pause : play}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-white/70 transition hover:border-white/30 hover:text-white"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <span>{settings.wordsAtATime} words · {settings.wpm} wpm</span>
              {eyeTrackingEnabled && (
                <span className={isLookingAway ? 'text-destructive' : 'text-white/60'}>
                  {isLookingAway ? 'Eye tracking paused' : 'Eye tracking active'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
