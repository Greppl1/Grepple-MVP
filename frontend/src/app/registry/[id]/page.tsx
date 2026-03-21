'use client';

import { use } from 'react';
import Link from 'next/link';
import { TOOLS, scoreColor, scoreBg } from '@/lib/mock-data';
import ScoreRing from '@/components/ScoreRing';
import Sparkline from '@/components/Sparkline';
import { IconChevronLeft, IconExternalLink } from '@/components/Icons';

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-24 h-2 rounded-full bg-elevated overflow-hidden">
          <div
            className={`h-full rounded-full ${scoreBg(value)}`}
            style={{ width: `${value}%`, opacity: 0.7 }}
          />
        </div>
        <span className={`font-mono text-sm font-bold w-8 text-right ${scoreColor(value)}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tool = TOOLS.find((t) => t.id === id);

  if (!tool) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-text mb-4">Tool not found</h1>
        <Link href="/registry" className="text-blue-bright hover:text-white transition-colors text-sm">
          Back to Registry
        </Link>
      </div>
    );
  }

  const categoryColor: Record<string, string> = {
    Search: 'text-blue bg-blue/10 border-blue/20',
    DeFi: 'text-green bg-green/10 border-green/20',
    DevTools: 'text-purple bg-purple/10 border-purple/20',
    Database: 'text-amber bg-amber/10 border-amber/20',
    AI: 'text-lavender bg-lavender/10 border-lavender/20',
    Data: 'text-blue-bright bg-blue-bright/10 border-blue-bright/20',
    Communication: 'text-amber bg-amber/10 border-amber/20',
  };

  const catClass = categoryColor[tool.category] ?? 'text-text-secondary bg-elevated border-border';

  return (
    <div className="p-6 lg:p-8 max-w-5xl animate-fade-in">
      {/* Back */}
      <Link
        href="/registry"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors mb-6"
      >
        <IconChevronLeft size={16} />
        Registry
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <ScoreRing score={tool.composite} size={96} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono">
              {tool.name}
            </h1>
            <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded border ${catClass}`}>
              {tool.category}
            </span>
          </div>
          <p className="text-text-secondary mb-3 leading-relaxed">{tool.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-text-dim">
            <span className="font-mono">{tool.builder}</span>
            <span>Last tested: {tool.lastTested === 'Never' ? 'Not yet tested' : tool.lastTested}</span>
          </div>
        </div>
      </div>

      {/* Metrics + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Detailed Scores */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Quality Breakdown
          </h2>
          <MetricRow label="Schema Health" value={tool.metrics.schemaHealth} />
          <MetricRow label="Discoverability" value={tool.metrics.discoverability} />
          <MetricRow label="Callability" value={tool.metrics.callability} />
          <MetricRow label="Success Rate" value={tool.metrics.successRate} />
        </div>

        {/* Trend */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            7-Day Trend
          </h2>
          <div className="flex-1 flex items-center justify-center">
            <Sparkline
              data={tool.trend}
              color={tool.composite >= 85 ? '#18DC7E' : tool.composite >= 60 ? '#4A6CF7' : '#F5A623'}
              width={200}
              height={80}
            />
          </div>
          <div className="flex justify-between text-xs text-text-dim mt-4">
            <span>7 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        {[
          { label: 'Composite', value: tool.composite },
          { label: 'Schema', value: tool.metrics.schemaHealth },
          { label: 'Discovery', value: tool.metrics.discoverability },
          { label: 'Success', value: tool.metrics.successRate },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-xl p-4 text-center"
          >
            <p className="text-xs text-text-dim mb-2">{card.label}</p>
            <p className={`text-3xl font-bold font-mono ${scoreColor(card.value)}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          href={`/builder/report?id=${tool.id}`}
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold"
        >
          View Diagnosis Report
        </Link>
        <button className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
          <IconExternalLink size={14} />
          View on BscScan
        </button>
      </div>
    </div>
  );
}
