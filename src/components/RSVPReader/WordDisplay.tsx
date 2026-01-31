import { useMemo } from 'react';

interface WordDisplayProps {
  word: string;
  fontSize: number;
}

// Find the optimal recognition point (ORP) - typically around 30% into the word
const getORPIndex = (word: string): number => {
  const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
  if (cleanWord.length <= 1) return 0;
  if (cleanWord.length <= 3) return 1;
  return Math.floor(cleanWord.length * 0.3);
};

export const WordDisplay = ({ word, fontSize }: WordDisplayProps) => {
  const { before, focal, after } = useMemo(() => {
    if (!word) return { before: '', focal: '', after: '' };
    
    // Handle multiple words
    const words = word.split(' ');
    if (words.length > 1) {
      // For multiple words, highlight the middle word's focal point
      const midIndex = Math.floor(words.length / 2);
      const targetWord = words[midIndex];
      const orpIndex = getORPIndex(targetWord);
      
      const beforeWords = words.slice(0, midIndex).join(' ');
      const afterWords = words.slice(midIndex + 1).join(' ');
      
      return {
        before: beforeWords + (beforeWords ? ' ' : '') + targetWord.slice(0, orpIndex),
        focal: targetWord[orpIndex] || '',
        after: targetWord.slice(orpIndex + 1) + (afterWords ? ' ' + afterWords : ''),
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
    <div className="flex items-center justify-center h-full">
      <div className="relative flex items-center">
        {/* ORP guide line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20 -translate-x-1/2" />
        
        {/* Word container */}
        <div 
          className="font-mono tracking-wide animate-word-enter flex items-center whitespace-nowrap"
          style={{ fontSize }}
        >
          <span className="text-foreground">{before}</span>
          <span className="text-primary text-glow font-semibold">{focal}</span>
          <span className="text-foreground">{after}</span>
        </div>
      </div>
    </div>
  );
};
