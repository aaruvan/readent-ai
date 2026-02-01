import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RSVPReader, RSVPReaderRef } from '@/components/RSVPReader';
import { useRef } from 'react';

const ABOUT_TEXT = `Swift Insight Reader

We build an AI-native reading system that compresses dense information into focused, high-comprehension streams. It blends RSVP presentation with adaptive pacing, contextual summarization, and intelligent emphasis so readers move faster without losing signal.

Product depth
Our AI summary model is context-aware and prioritizes intent, risks, and decisions. It generates highlight phrases that stay visible before focus, then carry into focus with gradient emphasis. We also chunk short phrases that are better read together and adjust spacing to preserve flow. Smart pacing slows on complex concepts and accelerates on filler, creating a natural cognitive rhythm.

Integrations
Keywords AI: We compare model outputs, test prompts before deployment, and maintain versioned prompt drafts to ship reliably. This gives us fast iteration cycles without quality regression.
Supabase: Edge functions power real-time AI features and secure orchestration. We also use logging to track a user’s average WPM over time to generate personalized reading recommendations.

Sponsors & tools
Lovable helped us spin up a working concept in hours, giving us a clean foundation to scale. trae.ai accelerated development across tasks with fast, reliable model selection; their tooling let us move from prototypes to production-quality flows quickly. These partners were required integrations, and they delivered real leverage.

Project tracking
We can detect when a reader steps away and when they return, then re-surface the most important context on screen so they re-enter the flow without friction. It’s the last-mile layer that turns speed into sustained comprehension.`;

const About = () => {
  const [showReader, setShowReader] = useState(false);
  const readerRef = useRef<RSVPReaderRef>(null);
  const [activeText, setActiveText] = useState(ABOUT_TEXT);

  const handleStartReading = () => {
    setActiveText(ABOUT_TEXT);
    setShowReader(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
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

      <main className="container mx-auto px-4 py-12 max-w-4xl space-y-10">
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Swift Insight Reader
          </h1>
          <p className="text-lg text-muted-foreground">
            We build an AI-native reading system that compresses dense information into focused, high-comprehension
            streams. It blends RSVP presentation with adaptive pacing, contextual summarization, and intelligent
            emphasis so readers move faster without losing signal.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Product depth</h2>
          <p className="text-muted-foreground">
            Our AI summary model is context-aware and prioritizes intent, risks, and decisions. It generates
            highlight phrases that stay visible before focus, then carry into focus with gradient emphasis.
            We also chunk short phrases that are better read together and adjust spacing to preserve flow.
            Smart pacing slows on complex concepts and accelerates on filler, creating a natural cognitive rhythm.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Integrations</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Keywords AI:</span> We compare model outputs, test prompts
              before deployment, and maintain versioned prompt drafts to ship reliably. This gives us fast iteration
              cycles without quality regression.
            </li>
            <li>
              <span className="font-medium text-foreground">Supabase:</span> Edge functions power real-time AI features
              and secure orchestration. We also use logging to track a user’s average WPM over time to generate
              personalized reading recommendations.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Sponsors & tools</h2>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Lovable</span> helped us spin up a working concept in hours,
            giving us a clean foundation to scale. <span className="font-medium text-foreground">trae.ai</span> accelerated
            development across tasks with fast, reliable model selection; their tooling let us move from prototypes to
            production-quality flows quickly. These partners were required integrations, and they delivered real leverage.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Project tracking</h2>
          <p className="text-muted-foreground">
            We can detect when a reader steps away and when they return, then re-surface the most important context
            on screen so they re-enter the flow without friction. It’s the last-mile layer that turns speed into
            sustained comprehension.
          </p>
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
