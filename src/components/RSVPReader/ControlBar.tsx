import { ChevronUp, ChevronDown, Zap, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface ControlBarProps {
  wpm: number;
  displayWpm: number;
  rampUpMultiplier: number;
  wordsAtATime: number;
  fontSize: number;
  timeLeft: string;
  onWPMChange: (wpm: number) => void;
  onWordsAtATimeChange: (count: number) => void;
  onFontSizeChange: (size: number) => void;
  aiSettingsSlot?: React.ReactNode;
}

interface ControlItemProps {
  label: string;
  value: React.ReactNode;
  onIncrement: () => void;
  onDecrement: () => void;
  icon?: React.ReactNode;
}

const ControlItem = ({ label, value, onIncrement, onDecrement, icon }: ControlItemProps) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-1">
      <button
        onClick={onIncrement}
        className="p-0.5 rounded hover:bg-control-hover transition-colors text-muted-foreground hover:text-foreground"
      >
        <ChevronUp className="w-3 h-3" />
      </button>
      <span className="text-sm font-medium min-w-[3ch] text-center flex items-center gap-1">
        {value}
        {icon}
      </span>
      <button
        onClick={onDecrement}
        className="p-0.5 rounded hover:bg-control-hover transition-colors text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  </div>
);

export const ControlBar = ({
  wpm,
  displayWpm,
  rampUpMultiplier,
  wordsAtATime,
  fontSize,
  timeLeft,
  onWPMChange,
  onWordsAtATimeChange,
  onFontSizeChange,
  aiSettingsSlot,
}: ControlBarProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-card/50 border-b border-border backdrop-blur-sm">
      <div className="flex items-center gap-6">
        {/* Time estimate */}
        <span className="text-sm text-muted-foreground font-medium">{timeLeft}</span>
        
        {/* WPM Control */}
        <ControlItem
          label="WPM"
          value={
            <span className="inline-flex items-center gap-1">
              {displayWpm}
              {rampUpMultiplier < 1 && (
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(rampUpMultiplier * 100)}%
                </span>
              )}
            </span>
          }
          icon={<Zap className="w-3 h-3 text-primary" />}
          onIncrement={() => onWPMChange(wpm + 25)}
          onDecrement={() => onWPMChange(wpm - 25)}
        />

        {/* Words at a time */}
        <ControlItem
          label="Words at a time"
          value={wordsAtATime}
          onIncrement={() => onWordsAtATimeChange(wordsAtATime + 1)}
          onDecrement={() => onWordsAtATimeChange(wordsAtATime - 1)}
        />

        {/* Font size */}
        <ControlItem
          label="Font size"
          value={fontSize}
          onIncrement={() => onFontSizeChange(fontSize + 4)}
          onDecrement={() => onFontSizeChange(fontSize - 4)}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* AI Settings slot */}
        <div className="flex items-center gap-2">
          {aiSettingsSlot}
          <span className="text-[11px] text-muted-foreground">Eye tracking here</span>
        </div>

        {/* Settings popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Reading Settings</h4>
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Speed: {wpm} WPM
                </label>
                <Slider
                  value={[wpm]}
                  min={50}
                  max={1200}
                  step={25}
                  onValueChange={([v]) => onWPMChange(v)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Words at a time: {wordsAtATime}
                </label>
                <Slider
                  value={[wordsAtATime]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={([v]) => onWordsAtATimeChange(v)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Font size: {fontSize}px
                </label>
                <Slider
                  value={[fontSize]}
                  min={24}
                  max={96}
                  step={4}
                  onValueChange={([v]) => onFontSizeChange(v)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
