'use client';

import Link from 'next/link';
import ScoreRing from '@/components/ScoreRing';
import Sparkline from '@/components/Sparkline';
import { IconPlus } from '@/components/Icons';

interface PublishedTool {
  id: string;
  name: string;
  category: string;
  composite: number;
  trend: number[];
  lastTested: string;
  status: 'Active' | 'Pending';
  description: string;
}

const MY_TOOLS: PublishedTool[] = [
  {
    id: '2',
    name: 'mcp-swap-tokens',
    category: 'DeFi',
    composite: 87,
    trend: [65, 70, 74, 78, 82, 85, 87],
    lastTested: '5m ago',
    status: 'Active',
    description: 'Cross-chain token swap via aggregated DEX routing with slippage protection.',
  },
  {
    id: '6',
    name: 'mcp-nft-mint',
    category: 'DeFi',
    composite: 71,
    trend: [50, 55, 60, 63, 66, 69, 71],
    lastTested: '20m ago',
    status: 'Active',
    description: 'NFT minting tool with metadata upload, collection management, and multi-chain support.',
  },
  {
    id: '11',
    name: 'mcp-bridge-tokens',
    category: 'DeFi',
    composite: 0,
    trend: [],
    lastTested: 'Never',
    status: 'Pending',
    description: 'Cross-chain bridge for ERC-20 tokens with optimistic verification.',
  },
];

const categoryColor = (cat: string) => {
  const colors: Record<string, string> = {
    DeFi: 'bg-blue/10 text-blue-bright border-blue/20',
    Search: 'bg-green-dim text-green border-green/20',
    DevTools: 'bg-purple-dim text-lavender border-purple/20',
    AI: 'bg-amber-dim text-amber border-amber/20',
    Database: 'bg-red-dim text-red border-red/20',
    Data: 'bg-green-dim text-green border-green/20',
    Communication: 'bg-purple-dim text-lavender border-purple/20',
  };
  return colors[cat] || 'bg-elevated text-text-secondary border-border';
};

const statusColor = (status: 'Active' | 'Pending') =>
  status === 'Active'
    ? 'bg-green-dim text-green'
    : 'bg-amber-dim text-amber';

export default function ToolsPage() {
  const hasTools = MY_TOOLS.length > 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-bright mb-2">My MCP Tools</h1>
          <p className="text-text-secondary">
            Manage and monitor your published MCP Tools.
          </p>
        </div>
        <Link
          href="/builder/submit"
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
        >
          <IconPlus size={16} />
          Submit New MCP Tool
        </Link>
      </div>

      {hasTools ? (
        <div className="space-y-4 stagger-children">
          {MY_TOOLS.map((tool) => (
            <div
              key={tool.id}
              className="bg-surface border border-border rounded-xl p-5 sm:p-6 card-glow"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {/* Score Ring */}
                <div className="flex-shrink-0">
                  {tool.composite > 0 ? (
                    <ScoreRing score={tool.composite} size={64} />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
                      <span className="text-text-dim text-xs font-mono">--</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-base sm:text-lg font-semibold text-white font-mono">
                      {tool.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium border ${categoryColor(
                        tool.category
                      )}`}
                    >
                      {tool.category}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${statusColor(
                        tool.status
                      )}`}
                    >
                      {tool.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary truncate">{tool.description}</p>
                  <p className="text-xs text-text-dim mt-1">
                    Last tested: {tool.lastTested}
                  </p>
                </div>

                {/* Sparkline */}
                <div className="flex-shrink-0 hidden sm:block">
                  {tool.trend.length > 0 ? (
                    <Sparkline data={tool.trend} width={100} height={32} />
                  ) : (
                    <span className="text-text-dim text-xs">No data</span>
                  )}
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  <Link
                    href={`/builder/report?id=${tool.id}&name=${encodeURIComponent(tool.name)}`}
                    className="text-sm text-blue-bright hover:text-white transition-colors font-medium btn-secondary rounded-lg px-5 py-2.5"
                  >
                    View Report
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-surface border border-border rounded-xl p-12 sm:p-16 text-center animate-slide-up">
          <div className="text-5xl mb-4 opacity-30 font-mono select-none">{"{ }"}</div>
          <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center mx-auto mb-5">
            <IconPlus size={24} className="text-text-dim" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No MCP Tools published yet</h2>
          <p className="text-text-secondary mb-2 max-w-md mx-auto">
            Submit your first MCP Tool to have it automatically diagnosed, scored, and listed in the Grepple registry.
          </p>
          <p className="text-text-dim text-sm mb-8 max-w-md mx-auto">
            Each MCP Tool receives a composite trust score, trend history, and detailed diagnostics so agents can discover and rely on it.
          </p>
          <Link
            href="/builder/submit"
            className="btn-gradient inline-block px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Submit Your First MCP Tool
          </Link>
        </div>
      )}
    </div>
  );
}
