import { Brain, Eye, FileText, Undo2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TextMode = 'original' | 'brief' | 'detailed';

interface AIStatusBarProps {
  // Feature states
  smartPacingEnabled: boolean;
  eyeTrackingEnabled: boolean;
  isLookingAway: boolean;
  
  // Text mode
  textMode: TextMode;
  onRestoreOriginal: () => void;
  isLoading: boolean;
  
  // Ramp up indicator
  rampUpMultiplier: number;
}

export const AIStatusBar = ({
  smartPacingEnabled,
  eyeTrackingEnabled,
  isLookingAway,
  textMode,
  onRestoreOriginal,
  isLoading,
  rampUpMultiplier,
}: AIStatusBarProps) => {
  const hasActiveFeatures = smartPacingEnabled || eyeTrackingEnabled || textMode !== 'original';
  
  if (!hasActiveFeatures && !isLoading) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
      {/* Loading indicator */}
      {isLoading && (
        <Badge variant="secondary" className="gap-1.5 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing...
        </Badge>
      )}
      
      {/* Smart Pacing indicator */}
      {smartPacingEnabled && (
        <Badge 
          variant="default" 
          className="gap-1.5 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
        >
          <Brain className="w-3 h-3" />
          Smart Pacing
        </Badge>
      )}
      
      {/* Focus Detection indicator */}
      {eyeTrackingEnabled && (
        <Badge 
          variant={isLookingAway ? "destructive" : "default"}
          className={cn(
            "gap-1.5 transition-colors",
            isLookingAway 
              ? "bg-destructive/20 text-destructive border-destructive/30" 
              : "bg-primary/20 text-primary border-primary/30"
          )}
        >
          <Eye className={cn("w-3 h-3", isLookingAway && "animate-pulse")} />
          {isLookingAway ? "Focus Lost" : "Tracking"}
          {rampUpMultiplier < 1 && !isLookingAway && (
            <span className="text-xs opacity-75">
              ({Math.round(rampUpMultiplier * 100)}%)
            </span>
          )}
        </Badge>
      )}
      
      {/* Text mode indicator */}
      {textMode !== 'original' && (
        <>
          <Badge 
            variant="secondary" 
            className="gap-1.5 bg-accent/50 text-accent-foreground"
          >
            <FileText className="w-3 h-3" />
            {textMode === 'brief' ? 'Brief Summary' : 'Detailed Summary'}
          </Badge>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestoreOriginal}
            className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="w-3 h-3" />
            Restore Original
          </Button>
        </>
      )}
    </div>
  );
};
