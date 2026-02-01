import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MinimalOverlayReader } from '@/components/RSVPReader/MinimalOverlayReader';

const ABOUT_TEXT = `About

We’re building a new category of reading infrastructure.

Most reading tools optimize for speed.
Readent.ai optimizes for what can’t be missed.

Our platform combines AI, adaptive pacing, and attention awareness to help people safely consume dense, high-stakes text — preserving context, structure, and intent instead of stripping them away.

From day one, this product was built AI-first. We use Keywords AI to compare and evaluate models, rigorously test and version prompts before deployment, and treat prompts as production assets. Reading behavior is logged to build contextual intelligence, including historical reading speed that informs personalized pacing. Supabase provides a secure, scalable backend for edge functions and session data.

Our AI-powered summarization doesn’t just shorten text — it preserves meaning. Key relationships, constraints, and risks are retained, while the original text is dynamically highlighted so readers always understand what matters and where it came from.

The system adapts in real time. Simple passages accelerate. Dense or critical sections slow down. Reading breaks are inevitable. People step away, get interrupted, or lose focus. When that happens, our system doesn’t blindly continue. It detects absence, pauses intelligently, rewinds to a safe point, and resumes at a controlled pace when the reader returns. Nothing is skipped. Nothing is rushed. Reading becomes resilient instead of fragile.

This foundation scales naturally into industries where missing information carries real consequences:

Legal — Text compresses without losing structure. Obligations, exceptions, and high-risk clauses slow pacing automatically and are flagged for review, allowing lawyers to move faster without sacrificing certainty.

Healthcare — The system adapts to medical context, slowing for diagnoses, dosages, and contraindications, flagging critical patient information, and making it easy to return to points of concern after attention breaks.

Finance & Compliance — Material risk language, numerical thresholds, and forward-looking statements are identified and emphasized, ensuring critical details are absorbed — not skimmed past.

We didn’t build different products for different verticals.
We built one reading intelligence engine that adapts behavior based on context and stakes.

We don’t help people read faster.
We help them miss less.

And in a world driven by dense text, that’s not a feature — it’s infrastructure.`;

const About = () => {
  const [showReader, setShowReader] = useState(false);
  const [activeText, setActiveText] = useState(ABOUT_TEXT);

  const handleStartReading = () => {
    setActiveText(ABOUT_TEXT);
    setShowReader(true);
  };

  const [title, ...bodyParagraphs] = ABOUT_TEXT.trim().split(/\n\s*\n/);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleStartReading}
          >
            <Eye className="w-4 h-4" />
            Speed Read This
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 pb-12 max-w-4xl space-y-10">
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
          <div className="space-y-5 text-muted-foreground">
            {bodyParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        {showReader && (
          <MinimalOverlayReader
            text={activeText}
            onClose={() => setShowReader(false)}
            wordsAtATime={3}
          />
        )}
      </main>
    </div>
  );
};

export default About;
