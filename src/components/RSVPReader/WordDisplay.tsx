import { useMemo } from 'react';

interface WordDisplayProps {
  word: string;
  fontSize: number;
  isKeyTerm?: boolean;
  highlightScore?: number;
}

// Find the optimal recognition point (ORP) index in the original word.
const getORPIndex = (word: string): number => {
  const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanWord.length <= 1) return 0;
  if (cleanWord.length <= 2) return 0; /* short units like "cm", "m" -> first letter */
  if (cleanWord.length <= 3) return 1;

  const targetCleanIndex = Math.floor(cleanWord.length * 0.3);
  let seen = 0;

  for (let i = 0; i < word.length; i += 1) {
    if (/[a-zA-Z0-9]/.test(word[i])) {
      if (seen === targetCleanIndex) {
        return i;
      }
      seen += 1;
    }
  }

  return Math.max(0, Math.min(word.length - 1, targetCleanIndex));
};

export const WordDisplay = ({ word, fontSize, isKeyTerm, highlightScore = 0 }: WordDisplayProps) => {
  const { before, focal, after } = useMemo(() => {
    if (!word) return { before: '', focal: '', after: '' };
    
    // Handle multiple words
    const words = word.split(' ');
    if (words.length > 1) {
      // For multiple words, pick the letter closest to the chunk center.
      const centerIndex = Math.floor(word.length / 2);
      let focusIndex = -1;

      const isValidFocusChar = (char: string) => /[a-zA-Z0-9]/.test(char);

      for (let offset = 0; offset <= word.length; offset += 1) {
        const leftIndex = centerIndex - offset;
        const rightIndex = centerIndex + offset;
        if (leftIndex >= 0 && isValidFocusChar(word[leftIndex])) {
          focusIndex = leftIndex;
          break;
        }
        if (rightIndex < word.length && isValidFocusChar(word[rightIndex])) {
          focusIndex = rightIndex;
          break;
        }
      }

      if (focusIndex < 0) {
        focusIndex = Math.max(0, Math.min(word.length - 1, centerIndex));
      }

      return {
        before: word.slice(0, focusIndex),
        focal: word[focusIndex] || '',
        after: word.slice(focusIndex + 1),
      };
    }
    
    // Single word
    const orpIndex = getORPIndex(word);
    return {
      before: word.slice(0, orpIndex),
      focal: word[orpIndex] || '',
      after: word.slice(orpIndex + 1),
    };
  }, [word]);

  if (!word) {
    return (
      <div className="flex items-center justify-center h-full">
        <span 
          className="text-muted-foreground font-mono animate-pulse-subtle"
          style={{ fontSize: fontSize * 0.5 }}
        >
          Ready to read
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="relative flex items-center justify-center w-full max-w-[min(90vw,640px)]">
        {/* ORP guide line - centered */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20 -translate-x-1/2" />
        
        {/* Key term indicator */}
        {isKeyTerm && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
            Key Term
          </div>
        )}
        
        {/* Word container: flex so focal letter sits under the ORP line */}
        <div 
          className={`font-mono tracking-wide animate-word-enter flex items-center gap-[0.025em] whitespace-nowrap relative w-full ${
            highlightScore > 0 ? 'rsvp-highlighted-word' : ''
          } ${isKeyTerm ? 'ring-2 ring-primary/30 ring-offset-4 ring-offset-background rounded-lg px-4' : ''}`}
          style={{
            fontSize,
            ...(highlightScore > 0 ? { ['--rsvp-highlight-alpha' as string]: String(0.08 + highlightScore * 0.18) } : {}),
          }}
        >
          <span className="flex-1 min-w-0 text-right text-foreground pr-[0.05em]">{before}</span>
          <span className="flex-none text-primary text-glow font-semibold">{focal}</span>
          <span className="flex-1 min-w-0 text-left text-foreground pl-[0.05em]">{after}</span>
        </div>
      </div>
    </div>
  );
};
