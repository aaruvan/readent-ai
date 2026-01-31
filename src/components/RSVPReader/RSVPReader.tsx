import { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRSVPReader } from '@/hooks/useRSVPReader';
import { WordDisplay } from './WordDisplay';
import { ControlBar } from './ControlBar';
import { PlaybackControls } from './PlaybackControls';

interface RSVPReaderProps {
  text?: string;
  onClose?: () => void;
}

export interface RSVPReaderRef {
  setText: (text: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const RSVPReader = forwardRef<RSVPReaderRef, RSVPReaderProps>(
  ({ text, onClose }, ref) => {
    const {
      words,
      currentIndex,
      currentWord,
      isPlaying,
      progress,
      settings,
      estimatedTimeLeft,
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
    } = useRSVPReader();

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      setText,
      play,
      pause,
      stop,
    }));

    // Set initial text
    useEffect(() => {
      if (text) {
        setText(text);
      }
    }, [text, setText]);

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
            stop();
            break;
        }
      },
      [togglePlay, skipBackward, skipForward, setWPM, settings.wpm, stop, onClose]
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
          wpm={settings.wpm}
          wordsAtATime={settings.wordsAtATime}
          fontSize={settings.fontSize}
          timeLeft={estimatedTimeLeft}
          onWPMChange={setWPM}
          onWordsAtATimeChange={setWordsAtATime}
          onFontSizeChange={setFontSize}
        />

        {/* Main reading area */}
        <div className="flex-1 min-h-[300px] relative">
          <WordDisplay word={currentWord} fontSize={settings.fontSize} />
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
