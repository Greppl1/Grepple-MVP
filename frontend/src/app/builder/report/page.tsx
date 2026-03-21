'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ScoreRing from '@/components/ScoreRing';
import { useToast } from '@/components/Toast';
import { IconCheck, IconArrowRight } from '@/components/Icons';

const SCORES = {
  composite: 82,
  schema: 91,
  discoverability: 74,
  callability: 78,
  successRate: 85,
};

const SCORE_CARDS = [
  { label: 'Schema Health', score: SCORES.schema },
  { label: 'Discoverability', score: SCORES.discoverability },
  { label: 'Callability', score: SCORES.callability },
  { label: 'Success Rate', score: SCORES.successRate },
];

const SUGGESTIONS = [
  {
    category: 'Schema' as const,
    impact: 'High' as const,
    text: 'Add "examples" field to slippage and amount parameters. Agents perform 23% better with concrete example values in the schema.',
  },
  {
    category: 'Description' as const,
    impact: 'High' as const,
    text: 'Include keywords "token swap", "DEX", and "cross-chain" in the tool description to improve agent discovery rate by ~12%.',
  },
  {
    category: 'Params' as const,
    impact: 'Medium' as const,
    text: 'Mark the "chain" parameter as an enum with supported values instead of a free-form string to reduce call errors by 18%.',
  },
];

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toolName = searchParams.get('name') || 'mcp-swap-tokens';
  const { toast } = useToast();
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());

  const handleApply = (index: number) => {
    setAppliedSuggestions((prev) => new Set(prev).add(index));
    toast('Suggestion applied!', 'success');
  };

  const handlePublish = () => {
    toast('Tool published to registry!', 'success');
    setTimeout(() => {
      router.push('/builder/tools');
    }, 1500);
  };

  const handleRunAgain = () => {
    window.location.reload();
  };

  const impactColor = (impact: string) => {
    if (impact === 'High') return 'bg-red-dim text-red';
    return 'bg-amber-dim text-amber';
  };

  const categoryColor = (category: string) => {
    if (category === 'Schema') return 'bg-purple-dim text-lavender';
    if (category === 'Description') return 'bg-green-dim text-green';
    return 'bg-blue-dim text-blue-bright';
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-text-dim font-mono mb-1">{toolName}</p>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Diagnosis Report</h1>
      </div>

      {/* Composite Score */}
      <div className="bg-surface border border-border rounded-xl p-8 mb-8 flex flex-col items-center gap-4 card-glow">
        <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Composite Score
        </p>
        <ScoreRing score={SCORES.composite} size={120} />
        <p className="text-text-dim text-sm">
          Overall tool readiness for agent consumption
        </p>
      </div>

      {/* Score Cards 2x2 Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {SCORE_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center gap-3"
          >
            <ScoreRing score={card.score} size={72} />
            <p className="text-sm font-medium text-white text-center">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Improvement Suggestions */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
          Improvement Suggestions
        </h2>
        <div className="space-y-4">
          {SUGGESTIONS.map((s, i) => (
            <div key={i} className="bg-elevated rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${categoryColor(
                    s.category
                  )}`}
                >
                  {s.category}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${impactColor(
                    s.impact
                  )}`}
                >
                  {s.impact} Impact
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{s.text}</p>
              <button
                onClick={() => handleApply(i)}
                disabled={appliedSuggestions.has(i)}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  appliedSuggestions.has(i)
                    ? 'text-green cursor-default'
                    : 'text-blue-bright hover:text-white'
                }`}
              >
                {appliedSuggestions.has(i) ? (
                  <>
                    <IconCheck size={12} />
                    Applied
                  </>
                ) : (
                  <>
                    <IconArrowRight size={12} />
                    Apply
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleRunAgain}
          className="btn-secondary px-8 py-3 rounded-xl text-sm font-semibold"
        >
          Run Again
        </button>
        <button
          onClick={handlePublish}
          className="btn-gradient px-8 py-3 rounded-xl text-sm font-semibold"
        >
          Publish to Registry
        </button>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl animate-fade-in">
      <Suspense fallback={<div className="text-text-dim">Loading...</div>}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
