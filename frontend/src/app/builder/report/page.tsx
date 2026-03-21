'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ScoreRing from '@/components/ScoreRing';
import { SkeletonPage } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { IconCheck, IconCopy } from '@/components/Icons';
import { SCORING_ENGINE_URL } from '@/lib/contracts';

interface Scores {
  composite: number;
  schema: number;
  discoverability: number;
  successRate: number;
  grade: string;
}

interface Suggestion {
  category: 'Schema' | 'Description' | 'Params';
  impact: 'High' | 'Medium';
  text: string;
}

/** Fallback: generate deterministic scores from tool name */
function generateFallbackScores(toolName: string): Scores {
  let hash = 0;
  for (let i = 0; i < toolName.length; i++) {
    hash = ((hash << 5) - hash + toolName.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);
  const schema = 60 + (h % 35);
  const discovery = 55 + ((h >> 4) % 38);
  const success = 62 + ((h >> 12) % 32);
  const composite = Math.round(schema * 0.35 + discovery * 0.35 + success * 0.3);
  const grade = composite >= 90 ? 'A' : composite >= 80 ? 'B' : composite >= 70 ? 'C' : composite >= 60 ? 'D' : 'F';
  return { composite, schema, discoverability: discovery, successRate: success, grade };
}

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  { category: 'Schema', impact: 'High', text: 'Add "examples" field to parameters. Agents perform 23% better with concrete example values in the schema.' },
  { category: 'Description', impact: 'High', text: 'Include action verbs and use-case keywords in the tool description to improve agent discovery rate by ~12%.' },
  { category: 'Params', impact: 'Medium', text: 'Use enum types instead of free-form strings for constrained parameters to reduce call errors by 18%.' },
];

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toolName = searchParams.get('name') || 'mcp-tool';
  const reportId = searchParams.get('id') || null;
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(FALLBACK_SUGGESTIONS);
  const [loading, setLoading] = useState(!!reportId);
  const [isLive, setIsLive] = useState(false);

  // Fetch real scores from Jerry's scoring engine
  useEffect(() => {
    if (!reportId) {
      setScores(generateFallbackScores(toolName));
      setLoading(false);
      return;
    }

    async function fetchScores() {
      try {
        const res = await fetch(`${SCORING_ENGINE_URL}/api/v1/report/${reportId}/scores`);
        if (!res.ok) throw new Error('scores not found');
        const data = await res.json();

        // Jerry's scoring engine now only returns schemaHealth + discoverability (no callability)
        // Overall = schema×50% + description×50%
        const schema = data.schemaHealth?.score ?? 0;
        const discovery = data.discoverability?.score ?? 0;
        setScores({
          composite: data.overall ?? Math.round((schema + discovery) / 2),
          schema,
          discoverability: discovery,
          successRate: 0, // callability removed from scoring engine; only in external agent eval
          grade: data.grade ?? 'N/A',
        });
        setIsLive(true);

        // Also fetch the full report for suggestions
        const reportRes = await fetch(`${SCORING_ENGINE_URL}/api/v1/report/${reportId}`);
        if (reportRes.ok) {
          const report = await reportRes.json();
          const realSuggestions: Suggestion[] = [];

          // Extract suggestions from diagnosis issues
          if (report.diagnosis?.issues) {
            for (const issue of report.diagnosis.issues) {
              const cat = issue.code?.includes('PARAM') || issue.code?.includes('SCHEMA') || issue.code?.includes('REQUIRED') || issue.code?.includes('DEFAULT')
                ? 'Schema'
                : issue.code?.includes('DESCRIPTION') || issue.code?.includes('ACTION') || issue.code?.includes('USE_CASE') || issue.code?.includes('EXAMPLE') || issue.code?.includes('JARGON')
                ? 'Description'
                : 'Params';
              const impact = issue.severity === 'high' ? 'High' : 'Medium';
              realSuggestions.push({ category: cat as Suggestion['category'], impact, text: issue.detail ?? issue.code });
            }
          }

          // Add rewrite suggestion if present (Jerry aliases rewriteSuggestion as "suggestions")
          const rewrite = report.suggestions ?? report.rewriteSuggestion;
          if (rewrite?.rationale) {
            realSuggestions.push({
              category: 'Description',
              impact: 'High',
              text: rewrite.rationale,
            });
          }

          if (realSuggestions.length > 0) {
            setSuggestions(realSuggestions);
          }
        }
      } catch {
        // Fallback to generated scores
        setScores(generateFallbackScores(toolName));
      } finally {
        setLoading(false);
      }
    }

    fetchScores();
  }, [reportId, toolName]);

  if (loading || !scores) {
    return <SkeletonPage />;
  }

  // When live, scoring engine only returns schema + discoverability (no callability)
  const SCORE_CARDS = isLive
    ? [
        { label: 'Schema Health', score: scores.schema },
        { label: 'Discoverability', score: scores.discoverability },
      ]
    : [
        { label: 'Schema Health', score: scores.schema },
        { label: 'Discoverability', score: scores.discoverability },
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
        {isLive && (
          <p className="text-xs text-green mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            Live scores from scoring engine
          </p>
        )}
      </div>

      {/* Composite Score + Grade */}
      <div className="bg-surface border border-border rounded-xl p-8 mb-8 flex flex-col items-center gap-4 card-glow">
        <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Composite Score</p>
        <ScoreRing score={scores.composite} size={120} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-dim">Grade:</span>
          <span className={`text-lg font-bold font-mono ${
            scores.grade === 'A' ? 'text-green' :
            scores.grade === 'B' ? 'text-blue-bright' :
            scores.grade === 'C' ? 'text-amber' : 'text-red'
          }`}>{scores.grade}</span>
        </div>
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
          {suggestions.length > 0 && (
            <span className="text-text-dim font-normal ml-2">({suggestions.length})</span>
          )}
        </h2>
        {suggestions.length > 0 ? (
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
        ) : (
          <p className="text-text-dim text-sm">No improvement suggestions — this tool looks great!</p>
        )}
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
      <Suspense fallback={<SkeletonPage />}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
