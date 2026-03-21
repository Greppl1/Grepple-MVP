'use client';

import { use } from 'react';
import Link from 'next/link';
import { useToolDetail } from '@/hooks/useRegistry';
import ScoreRing from '@/components/ScoreRing';
import Sparkline from '@/components/Sparkline';
import { SkeletonPage } from '@/components/Skeleton';
import { IconChevronRight, IconChevronLeft, IconExternalLink } from '@/components/Icons';

function barColor(value: number) {
  if (value >= 85) return 'bg-green';
  if (value >= 60) return 'bg-blue';
  return 'bg-amber';
}

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    Search: 'text-blue bg-blue/10 border-blue/20',
    DeFi: 'text-green bg-green/10 border-green/20',
    DevTools: 'text-purple bg-purple/10 border-purple/20',
    Database: 'text-amber bg-amber/10 border-amber/20',
    AI: 'text-lavender bg-lavender/10 border-lavender/20',
    Data: 'text-blue-bright bg-blue-bright/10 border-blue-bright/20',
    Communication: 'text-amber bg-amber/10 border-amber/20',
    Cloud: 'text-blue bg-blue/10 border-blue/20',
    Productivity: 'text-green bg-green/10 border-green/20',
  };
  const classes = colorMap[category] ?? 'text-text-secondary bg-elevated border-border';
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded border ${classes}`}>
      {category}
    </span>
  );
}

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tool, loading } = useToolDetail(id);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <SkeletonPage />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <h1 className="text-2xl font-bold text-text mb-4">Tool not found</h1>
        <p className="text-text-dim mb-6">This tool may have been removed or the ID is invalid.</p>
        <Link
          href="/registry"
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
        >
          <IconChevronLeft size={16} />
          Back to Registry
        </Link>
      </div>
    );
  }

  const metrics = [
    { label: 'Schema Health', value: tool.metrics.schemaHealth },
    { label: 'Discoverability', value: tool.metrics.discoverability },
    { label: 'Success Rate', value: tool.metrics.successRate },
  ];

  const sparklineColor =
    tool.composite >= 85 ? '#18DC7E' : tool.composite >= 60 ? '#4A6CF7' : '#F5A623';

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto page-enter">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-dim mb-6">
        <Link href="/registry" className="hover:text-white transition-colors">
          Registry
        </Link>
        <IconChevronRight size={12} />
        <span className="text-text-secondary font-mono truncate max-w-[240px]">{tool.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <CategoryBadge category={tool.category} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-mono mb-2">{tool.name}</h1>
          <p className="text-text-secondary leading-relaxed">{tool.description}</p>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <ScoreRing score={tool.composite} size={96} />
          <span className="text-xs text-text-dim mt-2 uppercase tracking-wider">Composite</span>
        </div>
      </div>

      {/* Quality Breakdown */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
          Quality Breakdown
        </h2>
        <div className="space-y-5">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">{m.label}</span>
                <span className="text-sm font-bold font-mono text-white">{m.value}/100</span>
              </div>
              <div className="metric-bar h-2 rounded-full bg-elevated overflow-hidden w-full">
                <div
                  className={`metric-bar-fill h-full rounded-full ${barColor(m.value)}`}
                  style={{ width: `${m.value}%`, transition: 'width 0.8s ease-out' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Section */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          7-Day Trend
        </h2>
        {tool.trend.length > 1 ? (
          <div>
            <Sparkline data={tool.trend} color={sparklineColor} width={600} height={64} />
            <div className="flex justify-between text-xs text-text-dim mt-3">
              <span>7 days ago</span>
              <span>Today</span>
            </div>
          </div>
        ) : (
          <p className="text-text-dim text-sm py-4">Not enough data for trend</p>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-dim mb-1">Builder</p>
          <p className="text-sm font-mono text-white truncate">{tool.builder}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-dim mb-1">Category</p>
          <div className="mt-0.5">
            <CategoryBadge category={tool.category} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-dim mb-1">Last Tested</p>
          <p className="text-sm text-white">
            {tool.lastTested === 'Never' ? 'Not yet tested' : tool.lastTested}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-dim mb-1">Registry ID</p>
          <p className="text-sm font-mono text-white">{tool.id}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
          <IconExternalLink size={14} />
          View on BscScan
        </button>
        <Link
          href="/registry"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:text-white transition-colors inline-flex items-center gap-2"
        >
          <IconChevronLeft size={14} />
          Back to Registry
        </Link>
      </div>
    </div>
  );
}
