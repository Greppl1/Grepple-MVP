'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ScoreRing from '@/components/ScoreRing';
import { useToast } from '@/components/Toast';
import { IconCheck, IconArrowRight, IconCopy } from '@/components/Icons';

// Generate deterministic but varied scores based on tool name
function generateScores(toolName: string) {
  let hash = 0;
  for (let i = 0; i < toolName.length; i++) {
    hash = ((hash << 5) - hash + toolName.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);
  const schema = 60 + (h % 35);
  const discovery = 55 + ((h >> 4) % 38);
  const callability = 58 + ((h >> 8) % 36);
  const success = 62 + ((h >> 12) % 32);
  const composite = Math.round(schema * 0.25 + discovery * 0.25 + callability * 0.3 + success * 0.2);
  return { composite, schema, discoverability: discovery, callability, successRate: success };
}

function generateSuggestions(toolName: string) {
  const suggestions = [
    { category: 'Schema' as const, impact: 'High' as const, text: `Add "examples" field to parameters. Agents perform 23% better with concrete example values in the schema.` },
    { category: 'Description' as const, impact: 'High' as const, text: `Include action verbs and use-case keywords in the tool description to improve agent discovery rate by ~12%.` },
    { category: 'Params' as const, impact: 'Medium' as const, text: `Use enum types instead of free-form strings for constrained parameters to reduce call errors by 18%.` },
    { category: 'Schema' as const, impact: 'Medium' as const, text: `Add "description" field to all parameters. Tools with 100% parameter description coverage score 15% higher.` },
    { category: 'Description' as const, impact: 'Medium' as const, text: `Include an example input/output pair in the tool description to help agents understand expected behavior.` },
  ];
  // Return 3-4 suggestions based on name hash
  let hash = 0;
  for (let i = 0; i < toolName.length; i++) hash = ((hash << 5) - hash + toolName.charCodeAt(i)) | 0;
  const count = 3 + (Math.abs(hash) % 2);
  const start = Math.abs(hash) % suggestions.length;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(suggestions[(start + i) % suggestions.length]);
  }
  return result;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toolName = searchParams.get('name') || 'mcp-tool';
  const { toast } = useToast();
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const scores = useMemo(() => generateScores(toolName), [toolName]);
  const suggestions = useMemo(() => generateSuggestions(toolName), [toolName]);

  const SCORE_CARDS = [
    { label: 'Schema Health', score: scores.schema },
    { label: 'Discoverability', score: scores.discoverability },
    { label: 'Callability', score: scores.callability },
    { label: 'Success Rate', score: scores.successRate },
  ];

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast('Suggestion copied to clipboard', 'success');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast('Failed to copy', 'error');
    }
  };

  const handlePublish = () => {
    toast('Tool published to registry!', 'success');
    setTimeout(() => { router.push('/builder/tools'); }, 1500);
  };

  const impactColor = (impact: string) => impact === 'High' ? 'bg-red-dim text-red' : 'bg-amber-dim text-amber';
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
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright">Diagnosis Report</h1>
      </div>

      {/* Composite Score */}
      <div className="bg-surface border border-border rounded-xl p-8 mb-8 flex flex-col items-center gap-4 card-glow">
        <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Composite Score</p>
        <ScoreRing score={scores.composite} size={120} />
        <p className="text-text-dim text-sm">Overall tool readiness for agent consumption</p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {SCORE_CARDS.map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center gap-3">
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
          {suggestions.map((s, i) => (
            <div key={i} className="bg-elevated rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${categoryColor(s.category)}`}>{s.category}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${impactColor(s.impact)}`}>{s.impact} Impact</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{s.text}</p>
              <button
                onClick={() => handleCopy(s.text, i)}
                className="flex items-center gap-1.5 text-xs font-medium transition-colors text-blue-bright hover:text-white"
              >
                {copiedIndex === i ? (
                  <><IconCheck size={12} /> Copied</>
                ) : (
                  <><IconCopy size={12} /> Copy suggestion</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => router.push('/builder/submit')}
          className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          Submit Another Tool
        </button>
        <button
          onClick={handlePublish}
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold"
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
      <Suspense fallback={<div className="text-text-dim">Loading report...</div>}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
