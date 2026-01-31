import { Play, Pause, SkipBack, SkipForward, RotateCcw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface PlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  currentIndex: number;
  totalWords: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onSeek: (position: number) => void;
  onFullscreen?: () => void;
}

export const PlaybackControls = ({
  isPlaying,
  progress,
  currentIndex,
  totalWords,
  onTogglePlay,
  onStop,
  onSkipForward,
  onSkipBackward,
  onSeek,
  onFullscreen,
}: PlaybackControlsProps) => {
  return (
    <div className="px-6 py-4 bg-card/30 border-t border-border backdrop-blur-sm">
      {/* Progress bar */}
      <div className="mb-4">
        <Slider
          value={[progress]}
          min={0}
          max={100}
          step={0.1}
          onValueChange={([v]) => {
            const newIndex = Math.floor((v / 100) * totalWords);
            onSeek(newIndex);
          }}
          className="cursor-pointer"
        />
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{currentIndex} / {totalWords} words</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-center gap-2">
        {/* Skip backward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipBackward}
          className="text-muted-foreground hover:text-foreground"
          title="Skip backward"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        {/* Play/Pause */}
        <Button
          variant="default"
          size="lg"
          onClick={onTogglePlay}
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </Button>

        {/* Skip forward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipForward}
          className="text-muted-foreground hover:text-foreground"
          title="Skip forward"
        >
          <SkipForward className="w-5 h-5" />
        </Button>

        {/* Restart */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          className="text-muted-foreground hover:text-foreground ml-4"
          title="Restart"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>

        {/* Fullscreen */}
        {onFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onFullscreen}
            className="text-muted-foreground hover:text-foreground"
            title="Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
