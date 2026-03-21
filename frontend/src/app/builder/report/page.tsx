'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ScoreRing from '@/components/ScoreRing';
import SubNav, { BUILDER_NAV } from '@/components/SubNav';
import { IconSkipForward } from '@/components/Icons';
import { useToast } from '@/components/Toast';

const TERMINAL_LINES = [
  { delay: 0, prefix: '\u2192', prefixColor: 'text-blue', text: 'Connecting to MCP server...' },
  { delay: 800, prefix: '\u2713', prefixColor: 'text-green', text: 'Connection established. Protocol v2.1 detected.' },
  { delay: 1500, prefix: '\u2192', prefixColor: 'text-blue', text: 'Fetching tool manifest and schema definitions...' },
  { delay: 2200, prefix: '\u2713', prefixColor: 'text-green', text: 'Schema loaded: 3 endpoints, 12 parameters.' },
  { delay: 2800, prefix: '\u2192', prefixColor: 'text-blue', text: 'Running diagnostic suite (schema, discovery, call, success)...' },
  { delay: 3500, prefix: '\u26A0', prefixColor: 'text-amber', text: 'Warning: description field lacks keyword density for agent discovery.' },
  { delay: 4200, prefix: '\u2713', prefixColor: 'text-green', text: 'Call test: swap(ETH, USDC, 0.1) \u2192 200 OK (342ms)' },
  { delay: 4800, prefix: '\u2713', prefixColor: 'text-green', text: 'Diagnosis complete. Generating report...' },
];

interface ScoreCard {
  label: string;
  score: number;
  delta: string;
}

const SCORE_CARDS: ScoreCard[] = [
  { label: 'Schema Health', score: 91, delta: '+5' },
  { label: 'Discoverability', score: 78, delta: '+3' },
  { label: 'Callability', score: 85, delta: '+7' },
  { label: 'Success Rate', score: 82, delta: '+2' },
];

const DETAIL_METRICS = [
  { label: 'Avg Response Time', value: '342ms', status: 'good' as const },
  { label: 'Param Fill Rate', value: '92%', status: 'good' as const },
  { label: 'Error Handling', value: 'Structured', status: 'good' as const },
  { label: 'Schema Completeness', value: '91%', status: 'good' as const },
  { label: 'Description Quality', value: '78%', status: 'warn' as const },
  { label: 'Edge Case Coverage', value: '65%', status: 'warn' as const },
];

const SUGGESTIONS = [
  {
    category: 'Description',
    text: 'Add keywords "token swap", "DEX", "cross-chain" to improve agent discoverability by ~12%.',
    impact: 'high' as const,
  },
  {
    category: 'Schema',
    text: 'Add "examples" field to slippage parameter. Agents perform 23% better with example values.',
    impact: 'medium' as const,
  },
  {
    category: 'Discoverability',
    text: 'Include supported chains in tool metadata. Agents filter by chain 40% of the time.',
    impact: 'high' as const,
  },
];

const COMPETITORS = [
  { name: 'mcp-swap-tokens', score: 84, you: true },
  { name: 'mcp-uniswap-v3', score: 91, you: false },
  { name: 'mcp-1inch-swap', score: 87, you: false },
  { name: 'mcp-jupiter-swap', score: 79, you: false },
];

function ReportContent() {
  const searchParams = useSearchParams();
  const toolName = searchParams.get('name') || 'mcp-swap-tokens';
  const [phase, setPhase] = useState<'terminal' | 'dashboard'>('terminal');
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const { toast } = useToast();

  const skipToDashboard = () => {
    setPhase('dashboard');
    setTimeout(() => setDashboardVisible(true), 50);
  };

  useEffect(() => {
    if (phase !== 'terminal') return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    TERMINAL_LINES.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisibleLines((v) => Math.max(v, i + 1));
      }, line.delay);
      timers.push(t);
    });

    const progressStart = setTimeout(() => {
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setProgress(Math.min(p, 100));
        if (p >= 100) clearInterval(interval);
      }, 40);
      timers.push(interval as unknown as ReturnType<typeof setTimeout>);
    }, 3000);
    timers.push(progressStart);

    const transitionTimer = setTimeout(() => {
      setPhase('dashboard');
      setTimeout(() => setDashboardVisible(true), 50);
    }, 5500);
    timers.push(transitionTimer);

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Update competitors to show submitted tool name
  const competitors = COMPETITORS.map((c) =>
    c.you ? { ...c, name: toolName } : c
  );

  const impactColor = (impact: string) => {
    if (impact === 'high') return 'bg-red-dim text-red';
    if (impact === 'medium') return 'bg-amber-dim text-amber';
    return 'bg-green-dim text-green';
  };

  const statusDot = (status: 'good' | 'warn') =>
    status === 'good' ? 'bg-green' : 'bg-amber';

  return (
    <>
      {phase === 'terminal' && (
        <div className="bg-[#0A0820] border border-border rounded-xl overflow-hidden">
          {/* Terminal Chrome */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red/60" />
              <span className="w-3 h-3 rounded-full bg-amber/60" />
              <span className="w-3 h-3 rounded-full bg-green/60" />
              <span className="ml-3 text-text-dim text-xs font-mono">
                grepple diagnose --tool {toolName}
              </span>
            </div>
            <button
              onClick={skipToDashboard}
              className="flex items-center gap-1.5 text-xs text-text-dim hover:text-white transition-colors px-2 py-1 rounded hover:bg-elevated"
            >
              <IconSkipForward size={12} />
              Skip
            </button>
          </div>

          {/* Terminal Body */}
          <div className="p-6 font-mono text-sm min-h-[300px] sm:min-h-[400px] space-y-2">
            {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} className="flex gap-3 animate-slide-up">
                <span className={`${line.prefixColor} w-4 text-center flex-shrink-0`}>
                  {line.prefix}
                </span>
                <span className="text-text-secondary">{line.text}</span>
              </div>
            ))}

            {visibleLines >= 5 && (
              <div className="mt-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-text-dim text-xs w-16">Progress</span>
                  <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple to-blue rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-text-dim text-xs w-10 text-right">{progress}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'dashboard' && (
        <div
          className={`transition-all duration-700 ${
            dashboardVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">Diagnosis Report</h1>
            <p className="text-text-secondary">
              {toolName} &mdash; Diagnosed on Mar 20, 2026
            </p>
          </div>

          {/* Score Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
            {SCORE_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center gap-3"
              >
                <ScoreRing score={card.score} size={72} />
                <div className="text-center">
                  <p className="text-sm font-medium text-white">{card.label}</p>
                  <span className="text-xs bg-green-dim text-green px-2 py-0.5 rounded-full font-mono mt-1 inline-block">
                    {card.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            {/* Left: Detailed Metrics */}
            <div className="flex-1 bg-surface border border-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
                Detailed Metrics
              </h2>
              <div className="space-y-4">
                {DETAIL_METRICS.map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${statusDot(m.status)}`} />
                      <span className="text-sm text-white">{m.label}</span>
                    </div>
                    <span className="font-mono text-sm text-text-secondary">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Suggestions */}
            <div className="lg:w-[40%] bg-surface border border-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
                Rewrite Suggestions
              </h2>
              <div className="space-y-4">
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="bg-elevated rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-lavender uppercase">
                        {s.category}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${impactColor(
                          s.impact
                        )}`}
                      >
                        {s.impact} impact
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{s.text}</p>
                    <button
                      onClick={() => toast(`Applied "${s.category}" suggestion`, 'success')}
                      className="text-xs text-blue-bright hover:text-white transition-colors font-medium"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Competitor Comparison */}
          <div className="bg-surface border border-border rounded-xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
              Category Comparison
            </h2>
            <div className="space-y-3">
              {competitors.sort((a, b) => b.score - a.score).map((c) => (
                <div key={c.name} className="flex items-center gap-4">
                  <span
                    className={`text-sm font-mono w-36 sm:w-40 truncate ${
                      c.you ? 'text-blue-bright font-semibold' : 'text-text-secondary'
                    }`}
                  >
                    {c.name}
                    {c.you && ' (you)'}
                  </span>
                  <div className="flex-1 h-3 bg-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        c.you
                          ? 'bg-gradient-to-r from-purple to-blue'
                          : 'bg-border-hi'
                      }`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-white w-10 text-right">{c.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => toast('Tool launched to Registry!', 'success')}
              className="btn-gradient px-8 py-3 rounded-xl text-sm font-semibold"
            >
              Launch to Registry
            </button>
            <button
              onClick={() => {
                setPhase('terminal');
                setVisibleLines(0);
                setProgress(0);
                setDashboardVisible(false);
              }}
              className="btn-secondary px-8 py-3 rounded-xl text-sm font-semibold"
            >
              Run Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ReportPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl animate-fade-in">
      <SubNav items={BUILDER_NAV} />
      <Suspense fallback={<div className="text-text-dim">Loading...</div>}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
