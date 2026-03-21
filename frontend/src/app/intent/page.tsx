'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapToFrontendTool, type SupabaseTool, type SupabaseBenchmark } from '@/lib/registry-adapter';
import type { Tool } from '@/lib/mock-data';
import { TOOLS as MOCK_TOOLS } from '@/lib/mock-data';
import { useToast } from '@/components/Toast';
import { IconSearch, IconSparkles, IconCheck, IconX, IconArrowRight, IconExternalLink } from '@/components/Icons';
import { Skeleton } from '@/components/Skeleton';
import ScoreRing from '@/components/ScoreRing';

/* ── helpers ─────────────────────────────────────────── */

const scoreColor = (v: number) => v >= 85 ? 'text-green' : v >= 60 ? 'text-text' : 'text-amber';
const barColor = (v: number) => v >= 85 ? 'bg-green' : v >= 60 ? 'bg-blue' : 'bg-amber';

const EXECUTION_STEPS = [
  { label: 'Analyzing tool schema...', duration: 1200 },
  { label: 'Generating test parameters...', duration: 800 },
  { label: 'Agent invoking tool...', duration: 2100 },
  { label: 'Validating response structure...', duration: 500 },
];

function generateVerdict(tool: Tool): string {
  const { schemaHealth, discoverability, successRate } = tool.metrics;
  const parts: string[] = [];

  if (schemaHealth >= 80) parts.push('Schema is well-defined with good field coverage.');
  else if (schemaHealth >= 50) parts.push(`Schema needs improvement \u2014 ${100 - schemaHealth}% of fields lack descriptions.`);
  else parts.push('Schema is poorly defined. Missing critical field descriptions and structure.');

  if (discoverability >= 80) parts.push('Tool is highly discoverable with clear naming and documentation.');
  else if (discoverability >= 50) parts.push('Discoverability is moderate. Consider adding action verbs and use-case examples.');
  else parts.push('Low discoverability \u2014 agents may struggle to find and understand this tool.');

  if (successRate > 0) {
    if (successRate >= 80) parts.push(`${successRate}% success rate in agent invocations.`);
    else parts.push(`${successRate}% success rate \u2014 reliability needs improvement.`);
  } else {
    parts.push('Not yet tested with live agent invocations.');
  }

  return parts.join(' ');
}

/* ── search ──────────────────────────────────────────── */

async function searchTools(query: string): Promise<Tool[]> {
  if (!isSupabaseConfigured || !supabase) {
    const q = query.toLowerCase();
    return MOCK_TOOLS.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    ).slice(0, 10);
  }

  const sb = supabase!;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const orConditions = words.map(w =>
    `tool_name.ilike.%${w}%,tool_description.ilike.%${w}%`
  ).join(',');

  const { data: toolsData, error } = await sb
    .from('tools_with_repo')
    .select('*')
    .or(orConditions)
    .limit(20);

  if (error || !toolsData) return [];

  const toolNames = toolsData.map((t: any) => t.tool_name);
  const { data: benchData } = await sb
    .from('benchmark_results')
    .select('*')
    .in('tool_name', toolNames);

  const benchMap = new Map<string, SupabaseBenchmark>();
  if (benchData) {
    for (const b of benchData as SupabaseBenchmark[]) {
      const existing = benchMap.get(b.tool_name);
      if (!existing || b.invoke_rate > existing.invoke_rate) {
        benchMap.set(b.tool_name, b);
      }
    }
  }

  const results = (toolsData as SupabaseTool[]).map(t =>
    mapToFrontendTool(t, benchMap.get(t.tool_name) ?? null)
  );
  results.sort((a, b) => b.composite - a.composite);
  return results.slice(0, 10);
}

/* ── metric bar ──────────────────────────────────────── */

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-xs text-text-dim w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(value)}`}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-7 text-right ${scoreColor(value)}`}>{value}</span>
    </div>
  );
}

/* ── execution panel ─────────────────────────────────── */

function ExecutionPanel({
  tool,
  step,
  done,
  stepTimings,
}: {
  tool: Tool;
  step: number;
  done: boolean;
  stepTimings: number[];
}) {
  return (
    <div className="bg-elevated rounded-xl p-6 mt-3 border border-border animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <IconSparkles size={18} className="text-blue-bright" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-text-secondary">
          Agent Execution
        </h3>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        {EXECUTION_STEPS.map((s, i) => {
          const completed = step > i;
          const active = step === i && !done;
          const pending = step <= i && !completed;
          const timing = stepTimings[i];

          return (
            <div key={i} className="flex items-center gap-3">
              {/* Icon */}
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {completed ? (
                  <IconCheck size={16} className="text-green" />
                ) : active ? (
                  <div className="w-4 h-4 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-border/60" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm flex-1 ${
                  completed ? 'text-text' : active ? 'text-blue-bright' : 'text-text-dim'
                }`}
              >
                {s.label}
              </span>

              {/* Timing */}
              {completed && timing != null && (
                <span className="text-xs text-text-dim font-mono">{(timing / 1000).toFixed(1)}s</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Results (after all steps done) */}
      {done && (
        <div className="animate-fade-in">
          <div className="border-t border-border/40 pt-5 mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-dim mb-4">Results</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ResultRow label="Schema Health" value={tool.metrics.schemaHealth} />
              <ResultRow label="Discoverability" value={tool.metrics.discoverability} />
              <ResultRow label="Success Rate" value={tool.metrics.successRate} />
              <ResultRow label="Composite" value={tool.composite} />
            </div>
          </div>

          {/* Verdict */}
          <div className="bg-surface rounded-lg border border-border/40 p-4 mb-5">
            <p className="text-sm text-text-secondary italic leading-relaxed">
              {generateVerdict(tool)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/builder/report/demo?tool=${encodeURIComponent(tool.name)}`}
              className="btn-ghost text-sm px-4 py-2 inline-flex items-center gap-2"
            >
              View Full Report
              <IconExternalLink size={14} />
            </Link>
            <Link
              href={`/builder/submit?tool=${encodeURIComponent(tool.name)}`}
              className="btn-gradient text-sm px-4 py-2 inline-flex items-center gap-2"
            >
              Submit for Diagnosis
              <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-dim w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor(value)}`}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className={`text-sm font-mono font-bold w-10 text-right ${scoreColor(value)}`}>
        {value}
      </span>
    </div>
  );
}

/* ── tool card ───────────────────────────────────────── */

function ToolCard({
  tool,
  isExecuting,
  executionStep,
  executionDone,
  stepTimings,
  onTest,
}: {
  tool: Tool;
  isExecuting: boolean;
  executionStep: number;
  executionDone: boolean;
  stepTimings: number[];
  onTest: () => void;
}) {
  return (
    <div>
      <div className="bg-surface rounded-xl p-5 border border-border card-glow transition-all duration-200">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-elevated text-text-secondary">
              {tool.category}
            </span>
            {tool.lastTested !== 'Never' && (
              <span className="text-xs text-text-dim">Tested {tool.lastTested}</span>
            )}
          </div>
          <ScoreRing score={tool.composite} size={48} />
        </div>

        {/* Name + description */}
        <h3 className="text-xl font-bold text-text mb-1.5">{tool.name}</h3>
        <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-4">
          {tool.description || 'No description available.'}
        </p>

        {/* Metric bars */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mb-4">
          <MetricBar label="Schema" value={tool.metrics.schemaHealth} />
          <MetricBar label="Discover" value={tool.metrics.discoverability} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/registry/${tool.id}`}
            className="btn-ghost text-sm px-4 py-2 inline-flex items-center gap-1.5"
          >
            View Details
          </Link>
          <button
            onClick={onTest}
            disabled={isExecuting && !executionDone}
            className={`text-sm px-4 py-2 inline-flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              isExecuting && !executionDone
                ? 'bg-elevated text-text-dim cursor-not-allowed'
                : 'btn-gradient'
            }`}
          >
            {isExecuting && !executionDone ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-blue border-t-transparent animate-spin" />
                Testing...
              </>
            ) : isExecuting && executionDone ? (
              <>
                <IconCheck size={14} />
                Tested
              </>
            ) : (
              <>
                Test with Agent
                <IconArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Execution panel */}
      {isExecuting && (
        <ExecutionPanel
          tool={tool}
          step={executionStep}
          done={executionDone}
          stepTimings={stepTimings}
        />
      )}
    </div>
  );
}

/* ── loading skeleton ────────────────────────────────── */

function SearchSkeleton() {
  return (
    <div className="space-y-4 mt-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface rounded-xl p-5 border border-border space-y-3">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── inner page (uses useSearchParams) ───────────────── */

function IntentPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Execution state
  const [executingToolId, setExecutingToolId] = useState<string | null>(null);
  const [executionStep, setExecutionStep] = useState(0);
  const [executionDone, setExecutionDone] = useState(false);
  const [stepTimings, setStepTimings] = useState<number[]>([]);
  const executionRef = useRef<boolean>(false);

  // Run search on mount if query present
  useEffect(() => {
    if (initialQuery.trim()) {
      runSearch(initialQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setSubmittedQuery(q.trim());
    setExecutingToolId(null);
    setExecutionStep(0);
    setExecutionDone(false);
    setStepTimings([]);

    try {
      const results = await searchTools(q.trim());
      setTools(results);
      if (results.length === 0) {
        toast('No tools found for that query. Try different keywords.', 'info');
      }
    } catch {
      toast('Search failed. Showing demo results.', 'error');
      const fallback = MOCK_TOOLS.slice(0, 5);
      setTools(fallback);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.replace(`/intent?q=${encodeURIComponent(query.trim())}`, { scroll: false });
    runSearch(query.trim());
  };

  const handleTestTool = useCallback((tool: Tool) => {
    if (executionRef.current) return;
    executionRef.current = true;

    setExecutingToolId(tool.id);
    setExecutionStep(0);
    setExecutionDone(false);
    setStepTimings([]);

    let step = 0;
    const timings: number[] = [];

    const runStep = () => {
      if (step < EXECUTION_STEPS.length) {
        setExecutionStep(step + 1);
        const jitter = (Math.random() - 0.5) * 400;
        const duration = Math.max(300, EXECUTION_STEPS[step].duration + jitter);
        timings.push(Math.round(duration));
        setStepTimings([...timings]);
        step++;
        setTimeout(runStep, duration);
      } else {
        setExecutionDone(true);
        executionRef.current = false;
      }
    };

    setTimeout(runStep, 500);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 page-enter">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="sticky top-0 z-20 pb-4 -mx-4 px-4 bg-gradient-to-b from-bg via-bg to-transparent">
        <div className="relative">
          <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Describe what you need... e.g. "swap tokens on Uniswap"'
            className="w-full bg-surface border border-border rounded-xl pl-12 pr-32 py-4 text-text placeholder:text-text-dim text-lg focus:border-blue focus:outline-none focus:ring-0 transition-colors"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-gradient text-sm px-5 py-2.5 rounded-lg font-medium inline-flex items-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Searching
              </>
            ) : (
              <>
                <IconSparkles size={16} />
                Find Tools
              </>
            )}
          </button>
        </div>
      </form>

      {/* Intent understanding banner */}
      {searched && submittedQuery && !loading && (
        <div className="mb-6 animate-fade-in">
          <p className="text-text-secondary">
            Showing tools for: <span className="text-text font-semibold">&ldquo;{submittedQuery}&rdquo;</span>
          </p>
          <p className="text-sm text-text-dim mt-1">
            {tools.length} tool{tools.length !== 1 ? 's' : ''} matched
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <SearchSkeleton />}

      {/* Results */}
      {!loading && searched && tools.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <IconSparkles size={18} className="text-blue-bright" />
            <h2 className="text-lg font-semibold">Recommended Tools</h2>
          </div>

          <div className="space-y-4">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                isExecuting={executingToolId === tool.id}
                executionStep={executingToolId === tool.id ? executionStep : 0}
                executionDone={executingToolId === tool.id ? executionDone : false}
                stepTimings={executingToolId === tool.id ? stepTimings : []}
                onTest={() => handleTestTool(tool)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && tools.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-elevated flex items-center justify-center mx-auto mb-4">
            <IconSearch size={28} className="text-text-dim" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No tools found</h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            Try different keywords or browse the full registry to discover available tools.
          </p>
          <Link href="/registry" className="btn-gradient text-sm px-6 py-2.5 rounded-lg inline-flex items-center gap-2">
            Browse Registry
            <IconArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Initial state (no search yet) */}
      {!loading && !searched && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-elevated flex items-center justify-center mx-auto mb-5">
            <IconSparkles size={32} className="text-blue-bright" />
          </div>
          <h2 className="text-2xl font-bold mb-3">What do you need?</h2>
          <p className="text-text-secondary max-w-md mx-auto mb-8 leading-relaxed">
            Describe your task in plain language. We will find the best MCP tools
            and let you test them with an AI agent before you commit.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'swap tokens on Uniswap',
              'search the web',
              'generate an image',
              'query a database',
              'send an email',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  router.replace(`/intent?q=${encodeURIComponent(suggestion)}`, { scroll: false });
                  runSearch(suggestion);
                }}
                className="text-sm px-4 py-2 rounded-full bg-surface border border-border text-text-secondary hover:text-text hover:border-blue/40 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── page export ─────────────────────────────────────── */

export default function IntentPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Skeleton className="h-14 w-full rounded-xl mb-6" />
        <SearchSkeleton />
      </div>
    }>
      <IntentPageInner />
    </Suspense>
  );
}
