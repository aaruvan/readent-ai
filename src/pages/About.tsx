import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RSVPReader, RSVPReaderRef } from '@/components/RSVPReader';
import { useRef } from 'react';

const ABOUT_TEXT = `About

We’re building a new category of reading infrastructure.

Most reading tools optimize for speed. We optimize for what can’t be missed. Our platform combines AI, adaptive pacing, and attention awareness to transform how people consume dense, high-stakes text — not by removing information, but by delivering it intelligently, in context, and at the right moment.

From day one, this product was built AI-first. We use Keywords AI to compare and evaluate models, rigorously test prompts before deployment, manage prompt versions as production assets, and log reading behavior to build contextual intelligence — including historical reading speed that informs personalized pacing. Supabase provides a secure, scalable backend for edge functions and session data. Lovable helped us rapidly validate the core product direction, and Trae.ai enabled fast, high-quality development across multiple models and workflows.

Our AI-powered summarization doesn’t just shorten text — it preserves context. Instead of stripping nuance, the system generates summaries that retain key relationships, constraints, and intent. As summarized or speed-read content is presented, the original text is dynamically highlighted to reflect what’s being emphasized, giving readers a clear mental map of what matters and where it came from.

Beyond summarization, the system understands how language is naturally processed. Certain words and phrases are more effective when read together, so we intelligently chunk short phrases instead of forcing word-by-word parsing. At the same time, our adaptive pacing engine adjusts reading speed based on conceptual difficulty, structure, punctuation, and semantic weight. Straightforward passages accelerate. Dense or critical sections slow down. The experience remains fluid, but never reckless.

All of this leads to our most important capability: attention awareness.

Reading breaks are inevitable. People step away, get interrupted, or lose focus. When that happens, our system doesn’t blindly continue. It detects absence, pauses intelligently, rewinds to a safe point, and resumes at a controlled pace when the reader returns. Nothing is skipped. Nothing is rushed. Reading becomes resilient instead of fragile.

This foundation allows the platform to scale naturally into industries where the cost of missing information is high.

In legal workflows, reading is inseparable from risk. Contracts, filings, and discovery can’t be summarized aggressively without consequences. Our system compresses legal text while preserving structure, slows automatically around obligations and exceptions, and flags high-risk clauses for review — allowing lawyers to move faster without sacrificing certainty.

In healthcare, the challenge isn’t speed — it’s cognitive load. Clinicians and researchers read constantly under pressure. Our system adapts to medical context, slowing for diagnoses, dosages, and contraindications, flagging critical patient information, and making it easy to return to prior points of concern when attention breaks.

In finance and compliance, reading is both a bottleneck and a competitive edge. Analysts and auditors work through dense reports and disclosures where precision is non-negotiable. Our platform identifies material risk language, numerical thresholds, and forward-looking statements, flagging what matters and adapting pacing so critical details are absorbed, not skimmed past.

We didn’t build multiple products for different verticals. We built a single reading intelligence engine that fine-tunes behavior, pacing, highlighting, and flags based on customer needs, domain context, and risk tolerance. The same core system behaves differently in law, medicine, or finance because the stakes are different. That adaptability is the product.

We don’t believe AI should replace human judgment. We believe it should reinforce it. Our technology doesn’t remove information; it protects it. It doesn’t push readers faster; it guides them more safely. It turns attention into a first-class signal and reading into a system that responds intelligently to how humans actually work.

We’re not helping people read faster.

We’re helping them miss less.

And in a world where decisions are driven by dense text, that’s not a feature — it’s infrastructure.`;

const About = () => {
  const [showReader, setShowReader] = useState(false);
  const readerRef = useRef<RSVPReaderRef>(null);
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
          <section className="pt-4">
            <div className="h-[500px]">
              <RSVPReader
                ref={readerRef}
                text={activeText}
                onClose={() => setShowReader(false)}
                startWithEyeTracking
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
              <Zap className="w-3 h-3" />
              Eye tracking enabled for this session
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default About;
