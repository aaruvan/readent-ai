import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RSVPReader, RSVPReaderRef } from '@/components/RSVPReader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Zap, BookOpen, Brain, Sparkles, Clock, Eye, Keyboard } from 'lucide-react';

const SAMPLE_TEXT = `Speed reading is a collection of reading methods which attempt to increase rates of reading without greatly reducing comprehension or retention. Methods include chunking and minimizing subvocalization. The many available speed reading training programs include books, videos, software, and seminars.

The Rapid Serial Visual Presentation technique, or RSVP, displays words one at a time at a fixed position on the screen. This eliminates the need for eye movement, which is one of the main factors limiting reading speed. By focusing on a single point, readers can absorb words faster than traditional reading methods allow.

Studies have shown that the average adult reads at about 200-300 words per minute. With RSVP training, readers can often double or even triple their reading speed while maintaining good comprehension. The key is finding the optimal speed for your personal comprehension level.

AI-enhanced speed reading takes this further by adapting the display timing based on word complexity, punctuation, and semantic importance. Longer words and sentences with complex punctuation automatically receive more display time, while simple, common words flash by quickly.

This adaptive approach mimics how skilled readers naturally adjust their pace—slowing down for difficult concepts and speeding through familiar territory. Combined with AI summarization, readers can choose between reading the full text or a condensed version, making it easier to quickly grasp the main points of any article or document.`;

const Index = () => {
  const [customText, setCustomText] = useState('');
  const [activeText, setActiveText] = useState(SAMPLE_TEXT);
  const [showReader, setShowReader] = useState(false);
  const readerRef = useRef<RSVPReaderRef>(null);
  const readerSectionRef = useRef<HTMLElement | null>(null);
  const inputSectionRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleStartReading = () => {
    setShowReader(true);
    setActiveText(customText || SAMPLE_TEXT);
  };

  const handleUseSampleText = () => {
    setCustomText(SAMPLE_TEXT);
  };

  const handleTryDemo = () => {
    setActiveText(SAMPLE_TEXT);
    setShowReader(true);
    window.setTimeout(() => {
      readerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleAddYourText = () => {
    window.setTimeout(() => {
      inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      textareaRef.current?.focus();
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="flex justify-start mb-6">
            <Link
              to="/about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm"
            >
              About Us
            </Link>
          </div>
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Eye className="w-4 h-4" />
              Attention-aware reading
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Read with{' '}
              <span className="text-primary">focus detection</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The reader pauses when you look away, rewinds to a safe point, and ramps back up when you return.
              No guessing where you left off.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <Button 
                size="lg" 
                className="gap-2"
                onClick={handleTryDemo}
              >
                <Zap className="w-5 h-5" />
                Try Eye Tracking
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2"
                onClick={handleAddYourText}
              >
                <BookOpen className="w-5 h-5" />
                Add Your Text
              </Button>
            </div>

            <div className="mt-8 text-sm text-muted-foreground">
              Want AI summarizing? Try the browser extension in `extension/`.
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Focus Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Pauses when you look away, rewinds to a safe point, then resumes smoothly
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Adaptive Ramp</h3>
                <p className="text-sm text-muted-foreground">
                  Ramps speed back up after rewinds so you do not lose comprehension
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Keyboard className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Hands-free Flow</h3>
                <p className="text-sm text-muted-foreground">
                  Eye tracking keeps you in flow without manual pausing or seeking
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Reader Section */}
      {showReader && (
        <section ref={readerSectionRef} className="py-8 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="h-[500px]">
              <RSVPReader 
                ref={readerRef}
                text={activeText} 
                onClose={() => setShowReader(false)} 
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Space</kbd> to play/pause • 
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono ml-2">←</kbd> 
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">→</kbd> to skip • 
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono ml-2">↑</kbd> 
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↓</kbd> to adjust speed
            </p>
          </div>
        </section>
      )}

      {/* Input Section */}
      <section id="input-section" ref={inputSectionRef} className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Paste Your Text</h2>
            <p className="text-muted-foreground">
              Enter any text you want to speed read, or use our sample text
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              ref={textareaRef}
              placeholder="Paste your article, essay, or any text here..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[200px] resize-none bg-card"
            />
            
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={handleStartReading} className="gap-2">
                <Zap className="w-4 h-4" />
                Start Reading
              </Button>
              <Button variant="outline" onClick={handleUseSampleText}>
                Use Sample Text
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Brain className="w-4 h-4" />
              AI-Powered
            </div>
            <h2 className="text-3xl font-bold mb-4">AI-Enhanced Reading</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Click the brain icon in the reader to access AI features powered by Keywords AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-background border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AI Summarization</h3>
                  <p className="text-sm text-muted-foreground">
                    Condense long articles into key points, then speed read the summary for quick comprehension
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-background border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Smart Pacing</h3>
                  <p className="text-sm text-muted-foreground">
                    LLM-powered semantic analysis slows down at important concepts and speeds through filler
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-background border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Focus Detection</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically pauses when you look away, rewinds, and ramps back up when you return
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-background border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Industry Modes</h3>
                  <p className="text-sm text-muted-foreground">
                    Specialized for legal, medical, and technical documents with domain-aware pacing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>
            RSVP Speed Reader Demo • Built with Lovable and Trae for Keywords AI hackathon
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
