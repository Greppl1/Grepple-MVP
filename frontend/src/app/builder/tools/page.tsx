'use client';

import Link from 'next/link';
import Sparkline from '@/components/Sparkline';
import { IconBuilder, IconPlus } from '@/components/Icons';
import { useAuth } from '@/providers/AuthProvider';

interface PublishedTool {
  id: string;
  name: string;
  category: string;
  score: number;
  trend: number[];
  lastTested: string;
  status: 'Active' | 'Pending' | 'Failed';
  description: string;
}

// Empty by default — realistic for new users
const MY_TOOLS: PublishedTool[] = [];

const categoryColor = (cat: string) => {
  const colors: Record<string, string> = {
    DeFi: 'bg-blue/10 text-blue-bright border-blue/20',
    Search: 'bg-green-dim text-green border-green/20',
    DevTools: 'bg-purple-dim text-lavender border-purple/20',
    AI: 'bg-amber-dim text-amber border-amber/20',
    Database: 'bg-red-dim text-red border-red/20',
    Data: 'bg-green-dim text-green border-green/20',
    Communication: 'bg-purple-dim text-lavender border-purple/20',
    Cloud: 'bg-blue/10 text-blue-bright border-blue/20',
    Productivity: 'bg-purple-dim text-lavender border-purple/20',
  };
  return colors[cat] || 'bg-elevated text-text-secondary border-border';
};

const statusColor = (status: 'Active' | 'Pending' | 'Failed') => {
  if (status === 'Active') return 'bg-green-dim text-green';
  if (status === 'Pending') return 'bg-amber-dim text-amber';
  return 'bg-red-dim text-red';
};

const scoreColor = (score: number) => {
  if (score >= 85) return 'text-green';
  if (score >= 60) return 'text-blue-bright';
  if (score > 0) return 'text-amber';
  return 'text-text-dim';
};

export default function ToolsPage() {
  const { isAuthenticated } = useAuth();
  const hasTools = MY_TOOLS.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text mb-1">My Tools</h1>
          <p className="text-text-secondary text-sm">
            Tools you&apos;ve submitted and their diagnostic scores.
          </p>
        </div>
        <Link
          href="/builder/submit"
          className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
        >
          <IconPlus size={16} />
          Submit New Tool
        </Link>
      </div>

      {hasTools ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {MY_TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={`/registry/${tool.id}`}
              className="bg-surface border border-border rounded-xl p-5 card-glow block transition-all hover:border-border-hi"
            >
              {/* Top row: name + badges */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white font-mono truncate">
                      {tool.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${categoryColor(
                        tool.category
                      )}`}
                    >
                      {tool.category}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(
                        tool.status
                      )}`}
                    >
                      {tool.status}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  {tool.score > 0 ? (
                    <span className={`text-2xl font-bold font-mono ${scoreColor(tool.score)}`}>
                      {tool.score}
                    </span>
                  ) : (
                    <span className="text-2xl font-bold font-mono text-text-dim">--</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-text-secondary truncate mb-3">{tool.description}</p>

              {/* Bottom row: last tested + sparkline */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-dim">
                  Last tested: {tool.lastTested}
                </p>
                <div className="flex-shrink-0">
                  {tool.trend.length > 0 ? (
                    <Sparkline data={tool.trend} width={80} height={24} />
                  ) : (
                    <span className="text-text-dim text-xs">No data</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="empty-state py-16 sm:py-24">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center mb-6">
              <IconBuilder size={32} className="text-text-dim" />
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">No tools submitted yet</h2>
            <p className="text-text-secondary text-sm mb-8 leading-relaxed">
              Submit your first tool to get an automated quality diagnosis and list it in the registry.
            </p>
            <Link
              href="/builder/submit"
              className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              <IconPlus size={16} />
              Submit Your First Tool
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
