import { useState } from 'react';
import { Brain, Eye, Briefcase, Scale, Stethoscope, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import type { IndustryMode } from '@/hooks/useAIFeatures';

interface AISettingsPanelProps {
  // AI Features
  smartPacingEnabled: boolean;
  onSmartPacingChange: (enabled: boolean) => void;
  eyeTrackingEnabled: boolean;
  onEyeTrackingChange: (enabled: boolean) => void;
  industryMode: IndustryMode;
  onIndustryModeChange: (mode: IndustryMode) => void;
  
  // Eye tracking status
  isLookingAway?: boolean;
}

const industryIcons = {
  general: Briefcase,
  legal: Scale,
  medical: Stethoscope,
  technical: Cpu,
};

export const AISettingsPanel = ({
  smartPacingEnabled,
  onSmartPacingChange,
  eyeTrackingEnabled,
  onEyeTrackingChange,
  industryMode,
  onIndustryModeChange,
  isLookingAway,
}: AISettingsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const IndustryIcon = industryIcons[industryMode];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary hover:text-primary/80 relative"
          title="AI Features"
        >
          <Brain className="w-5 h-5" />
          {(smartPacingEnabled || eyeTrackingEnabled) && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Features
          </SheetTitle>
          <SheetDescription>
            Enhance your reading experience with AI-powered features
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Smart Pacing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <Label htmlFor="smart-pacing" className="font-medium">
                  Smart Pacing
                </Label>
              </div>
              <Switch
                id="smart-pacing"
                checked={smartPacingEnabled}
                onCheckedChange={onSmartPacingChange}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              AI analyzes text to slow down on important concepts and speed through filler words
            </p>
          </div>

          <Separator />

          {/* Eye Tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <Label htmlFor="eye-tracking" className="font-medium">
                  Focus Detection
                </Label>
              </div>
              <Switch
                id="eye-tracking"
                checked={eyeTrackingEnabled}
                onCheckedChange={onEyeTrackingChange}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically pauses and rewinds when you look away, then gradually ramps back up
            </p>
            {eyeTrackingEnabled && isLookingAway && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <Eye className="w-4 h-4" />
                Focus lost - paused
              </div>
            )}
          </div>

          <Separator />

          {/* Industry Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IndustryIcon className="w-4 h-4 text-primary" />
              <Label className="font-medium">Industry Mode</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Optimize for specialized vocabulary and document types
            </p>
            <Select value={industryMode} onValueChange={(v) => onIndustryModeChange(v as IndustryMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    General
                  </div>
                </SelectItem>
                <SelectItem value="legal">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Legal
                  </div>
                </SelectItem>
                <SelectItem value="medical">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Medical
                  </div>
                </SelectItem>
                <SelectItem value="technical">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Technical
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
