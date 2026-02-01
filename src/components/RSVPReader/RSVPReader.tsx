import { useEffect, useCallback, forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { useRSVPReader } from '@/hooks/useRSVPReader';
import { useAIFeatures, type IndustryMode } from '@/hooks/useAIFeatures';
import { useEyeTracking, calculateRewindPosition } from '@/hooks/useEyeTracking';
import { WordDisplay } from './WordDisplay';
import { ControlBar } from './ControlBar';
import { PlaybackControls } from './PlaybackControls';
import { AISettingsPanel } from './AISettingsPanel';
import { AIStatusBar, type TextMode } from './AIStatusBar';
import { useToast } from '@/hooks/use-toast';

interface RSVPReaderProps {
  text?: string;
  onClose?: () => void;
  startWithEyeTracking?: boolean;
}

export interface RSVPReaderRef {
  setText: (text: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const RSVPReader = forwardRef<RSVPReaderRef, RSVPReaderProps>(
  ({ text, onClose, startWithEyeTracking }, ref) => {
    const { toast } = useToast();
    
    // AI Feature States
    const [smartPacingEnabled, setSmartPacingEnabled] = useState(false);
    const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(false);
    const [industryMode, setIndustryMode] = useState<IndustryMode>('general');
    const [originalText, setOriginalText] = useState('');
    const [rampUpMultiplier, setRampUpMultiplier] = useState(1);
    const [textMode, setTextMode] = useState<TextMode>('original');

    const {
      words,
      currentIndex,
      currentWord,
      isPlaying,
      progress,
      settings,
      estimatedTimeLeft,
      pacingData,
      speedMultiplier,
      setText,
      togglePlay,
      stop,
      play,
      pause,
      skipForward,
      skipBackward,
      goToPosition,
      setWPM,
      setWordsAtATime,
      setFontSize,
      setPacingData,
      setSpeedMultiplier,
    } = useRSVPReader();

    const {
      isLoading: isAILoading,
      error: aiError,
      summaryHighlights,
      summarizeText,
      analyzePacing,
      clearResults,
    } = useAIFeatures();

    // Eye tracking with rewind functionality
    const {
      isTracking,
      isLookingAway,
      error: eyeError,
      startTracking,
      stopTracking,
    } = useEyeTracking({
      onLookAway: () => {
        if (!eyeTrackingEnabled) return;
        lastIndexRef.current = currentIndex;
        wasPlayingBeforeAwayRef.current = isPlaying;
        pendingRewindRef.current = true;
        if (isPlaying) {
          pausedByEyeRef.current = true;
          pause();
          toast({
            title: "Focus lost",
            description: "Reading paused. Look back to continue.",
          });
        }
      },
      onLookBack: () => {
        if (!eyeTrackingEnabled) return;
        if (pendingRewindRef.current) {
          pendingRewindRef.current = false;
          pausedByEyeRef.current = false;
          const rewindWords = Math.max(1, Math.min(6, Math.round(settings.wpm / 200)));
          const baseIndex = lastIndexRef.current ?? currentIndex;
          const { newIndex, rampUpSpeed } = calculateRewindPosition(baseIndex, rewindWords, words.length);
          goToPosition(newIndex);
          setRampUpMultiplier(rampUpSpeed);
          
          const rampInterval = setInterval(() => {
            setRampUpMultiplier(prev => {
              if (prev >= 1) {
                clearInterval(rampInterval);
                return 1;
              }
              return prev + 0.1;
            });
          }, 500);

          if (wasPlayingBeforeAwayRef.current) {
            play();
          }
          toast({
            title: "Welcome back!",
            description: `Rewinding ~${rewindWords} words and ramping up speed.`,
          });
        }
      },
      lossMs: 0,
      recoverMs: 0,
      minFaceAreaRatio: 0.02,
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      setText: (newText: string) => {
        setOriginalText(newText);
        setText(newText);
      },
      play,
      pause,
      stop,
    }));

    // Set initial text
    useEffect(() => {
      if (text) {
        setOriginalText(text);
        setText(text);
      }
    }, [text, setText]);

    // Handle eye tracking toggle
    const pausedByEyeRef = useRef(false);
    const pendingRewindRef = useRef(false);
    const wasPlayingBeforeAwayRef = useRef(false);
    const lastIndexRef = useRef(0);

    useEffect(() => {
      lastIndexRef.current = currentIndex;
    }, [currentIndex]);

    useEffect(() => {
      if (eyeTrackingEnabled) {
        startTracking();
      } else {
        stopTracking();
      }
    }, [eyeTrackingEnabled, startTracking, stopTracking]);

    useEffect(() => {
      if (startWithEyeTracking) {
        setEyeTrackingEnabled(true);
      }
    }, [startWithEyeTracking]);

    useEffect(() => {
      if (eyeTrackingEnabled && isLookingAway && isPlaying) {
        pausedByEyeRef.current = true;
        pause();
      }
      if (eyeTrackingEnabled && !isLookingAway && pausedByEyeRef.current && !isPlaying) {
        pausedByEyeRef.current = false;
        play();
      }
    }, [eyeTrackingEnabled, isLookingAway, isPlaying, pause, play]);

    useEffect(() => {
      setSpeedMultiplier(rampUpMultiplier);
    }, [rampUpMultiplier, setSpeedMultiplier]);

    // Handle smart pacing toggle
    useEffect(() => {
      if (smartPacingEnabled && originalText && !pacingData) {
        analyzePacing(originalText, industryMode).then((data) => {
          if (data) {
            setPacingData(data);
            toast({
              title: "Smart pacing enabled",
              description: "Reading speed will adapt to content complexity.",
            });
          }
        });
      } else if (!smartPacingEnabled) {
        setPacingData(null);
      }
    }, [smartPacingEnabled, originalText, industryMode, analyzePacing, setPacingData, toast, pacingData]);

    // Show AI errors
    useEffect(() => {
      if (aiError) {
        toast({
          variant: "destructive",
          title: "AI Error",
          description: aiError,
        });
      }
    }, [aiError, toast]);

    useEffect(() => {
      if (eyeError) {
        toast({
          variant: "destructive",
          title: "Eye tracking error",
          description: eyeError,
        });
      }
    }, [eyeError, toast]);

    const [activeHighlights, setActiveHighlights] = useState<typeof summaryHighlights>([]);

    const getHighlightScoreForText = useCallback((text: string) => {
      if (!text || activeHighlights.length === 0) return 0;
      const lower = text.toLowerCase();
      let maxScore = 0;
      for (const h of activeHighlights) {
        const phrase = String(h?.phrase || '').trim();
        if (!phrase) continue;
        if (lower.includes(phrase.toLowerCase())) {
          const score = Number.isFinite(h.score) ? Math.max(0, Math.min(1, h.score)) : 0.6;
          if (score > maxScore) maxScore = score;
        }
      }
      return maxScore;
    }, [activeHighlights]);

    // Handle summarization
    const handleSummarize = useCallback(async (length: 'brief' | 'detailed') => {
      if (!originalText) return;
      
      const result = await summarizeText(originalText, length);
      if (result) {
        setText(result.summary);
        setActiveHighlights(result.highlights || []);
        setTextMode(length);
        toast({
          title: "Summary ready",
          description: `${length === 'brief' ? 'Brief' : 'Detailed'} summary loaded for reading.`,
        });
      }
    }, [originalText, summarizeText, setText, toast]);

    // Restore original text
    const handleRestoreOriginal = useCallback(() => {
      if (originalText) {
        setText(originalText);
        setTextMode('original');
        setActiveHighlights([]);
        clearResults();
        toast({ title: "Original text restored" });
      }
    }, [originalText, setText, clearResults, toast]);

    // Keyboard shortcuts
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            togglePlay();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            skipBackward();
            break;
          case 'ArrowRight':
            e.preventDefault();
            skipForward();
            break;
          case 'ArrowUp':
            e.preventDefault();
            setWPM(settings.wpm + 25);
            break;
          case 'ArrowDown':
            e.preventDefault();
            setWPM(settings.wpm - 25);
            break;
          case 'Escape':
            if (onClose) onClose();
            break;
          case 'KeyR':
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            // Restore original text
            if (textMode !== 'original' && originalText) {
              handleRestoreOriginal();
            } else {
              stop();
            }
            break;
        }
      },
      [togglePlay, skipBackward, skipForward, setWPM, settings.wpm, stop, onClose, textMode, originalText, handleRestoreOriginal]
    );

    useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleFullscreen = () => {
      const elem = document.documentElement;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        elem.requestFullscreen();
      }
    };

    return (
      <div className="flex flex-col h-full bg-background reader-overlay rounded-xl overflow-hidden border border-border shadow-2xl">
        {/* Control bar */}
        <ControlBar
          wpm={Math.round(settings.wpm * rampUpMultiplier)}
          wordsAtATime={settings.wordsAtATime}
          fontSize={settings.fontSize}
          timeLeft={estimatedTimeLeft}
          onWPMChange={setWPM}
          onWordsAtATimeChange={setWordsAtATime}
          onFontSizeChange={setFontSize}
          aiSettingsSlot={
            <AISettingsPanel
              smartPacingEnabled={smartPacingEnabled}
              onSmartPacingChange={setSmartPacingEnabled}
              eyeTrackingEnabled={eyeTrackingEnabled}
              onEyeTrackingChange={setEyeTrackingEnabled}
              industryMode={industryMode}
              onIndustryModeChange={setIndustryMode}
              onSummarize={handleSummarize}
              isSummarizing={isAILoading}
              isLookingAway={isLookingAway}
            />
          }
        />
        
        {/* AI Status Bar */}
        <AIStatusBar
          smartPacingEnabled={smartPacingEnabled}
          eyeTrackingEnabled={eyeTrackingEnabled}
          isLookingAway={isLookingAway}
          textMode={textMode}
          onRestoreOriginal={handleRestoreOriginal}
          isLoading={isAILoading}
          rampUpMultiplier={rampUpMultiplier}
        />

        {/* Main reading area */}
        <div className="flex-1 min-h-[300px] relative">
          <WordDisplay 
            word={currentWord} 
            fontSize={settings.fontSize}
            isKeyTerm={pacingData?.[currentIndex]?.isKeyTerm}
            highlightScore={textMode !== 'original' ? getHighlightScoreForText(currentWord) : 0}
          />
          
          {/* Eye tracking indicator */}
          {eyeTrackingEnabled && isLookingAway && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center space-y-2">
                <div className="text-4xl">👁️</div>
                <p className="text-muted-foreground">Waiting for you to return...</p>
              </div>
            </div>
          )}

        </div>

        {/* Playback controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          progress={progress}
          currentIndex={currentIndex}
          totalWords={words.length}
          onTogglePlay={togglePlay}
          onStop={stop}
          onSkipForward={skipForward}
          onSkipBackward={skipBackward}
          onSeek={goToPosition}
          onFullscreen={handleFullscreen}
        />
      </div>
    );
  }
);

RSVPReader.displayName = 'RSVPReader';
