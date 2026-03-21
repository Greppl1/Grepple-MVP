'use client';

import { use } from 'react';
import Link from 'next/link';
import { useToolDetail } from '@/hooks/useRegistry';
import ScoreRing from '@/components/ScoreRing';
import Sparkline from '@/components/Sparkline';
import { SkeletonPage } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import {
  IconChevronRight,
  IconChevronLeft,
  IconExternalLink,
  IconCopy,
  IconArrowRight,
} from '@/components/Icons';
import type { Tool } from '@/lib/mock-data';

/* ─── Helpers ──────────────────────────────────────────────────────── */

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

/* ─── Code Block with Copy ─────────────────────────────────────────── */

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast('Copied to clipboard', 'success');
  };
  return (
    <div className="relative bg-bg rounded-lg border border-border overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-elevated/50">
          <span className="text-xs text-text-dim font-mono">{label}</span>
          <button
            onClick={handleCopy}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1 rounded hover:bg-elevated transition-colors"
          >
            <IconCopy size={14} /> Copy
          </button>
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-text-secondary overflow-x-auto whitespace-pre">
        {code}
      </pre>
      {!label && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded hover:bg-elevated transition-colors text-text-dim hover:text-white"
        >
          <IconCopy size={16} />
        </button>
      )}
    </div>
  );
}

/* ─── Integration Helpers ──────────────────────────────────────────── */

function generateMcpConfig(tool: Tool): string {
  const serverName = tool.repoName?.split('/').pop() ?? tool.name.replace(/[^a-zA-Z0-9]/g, '_');
  const sourceFile = tool.sourceFile ?? 'index.js';
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command: 'node',
          args: [sourceFile],
        },
      },
    },
    null,
    2,
  );
}

function generateInstallCommands(tool: Tool): string {
  if (!tool.githubUrl) return '# No repository URL available';
  const repoName = tool.repoName?.split('/').pop() ?? 'mcp-server';
  return `git clone ${tool.githubUrl}\ncd ${repoName}\nnpm install && npm start`;
}

function formatSchema(schemaStr: string | undefined): string | null {
  if (!schemaStr) return null;
  try {
    const schema = JSON.parse(schemaStr);
    if (schema.properties) {
      return JSON.stringify(schema.properties, null, 2);
    }
    return JSON.stringify(schema, null, 2);
  } catch {
    return null;
  }
}

/* ─── Page Component ───────────────────────────────────────────────── */

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

  const hasIntegration = !!tool.githubUrl || !!tool.repoName;
  const formattedSchema = formatSchema(tool.inputSchema);

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

      {/* ────────────────────────────────────────────────────────────── */}
      {/* HOW TO USE THIS TOOL — the key section                       */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <IconArrowRight size={18} className="text-lavender" />
          How to Use This Tool
        </h2>

        {hasIntegration ? (
          <div className="space-y-6">
            {/* Source Repository */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Source Repository
              </h3>
              <div className="bg-elevated rounded-lg border border-border p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-lavender/10 border border-lavender/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-lavender">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white font-mono truncate">
                    {tool.repoName ?? 'Repository'}
                  </p>
                  {tool.githubUrl && (
                    <a
                      href={tool.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-lavender hover:text-white transition-colors inline-flex items-center gap-1 mt-0.5"
                    >
                      {tool.githubUrl.replace('https://github.com/', 'github.com/')}
                      <IconExternalLink size={10} />
                    </a>
                  )}
                  {tool.sourceFile && (
                    <p className="text-xs text-text-dim mt-1">
                      File: <span className="font-mono text-text-secondary">{tool.sourceFile}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 1: Install & Run */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lavender/20 text-lavender text-xs font-bold mr-2">1</span>
                Install &amp; Run the MCP Server
              </h3>
              <CodeBlock code={generateInstallCommands(tool)} label="Terminal" />
            </div>

            {/* Step 2: MCP Client Config */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lavender/20 text-lavender text-xs font-bold mr-2">2</span>
                Add to Your MCP Client
              </h3>
              <CodeBlock code={generateMcpConfig(tool)} label="mcp_config.json" />
              <p className="text-xs text-text-dim mt-2">
                Works with: Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.
              </p>
            </div>

            {/* Step 3: Input Schema */}
            {formattedSchema && (
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lavender/20 text-lavender text-xs font-bold mr-2">3</span>
                  Input Schema
                </h3>
                <CodeBlock code={formattedSchema} label="Parameters" />
              </div>
            )}
          </div>
        ) : (
          /* No integration data available */
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-elevated-2 border border-border flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm mb-1">
              Integration details not available for this tool.
            </p>
            <p className="text-text-dim text-xs mb-5">
              Submit it for diagnosis to generate a full integration report.
            </p>
            <Link
              href="/builder/submit"
              className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              Submit for Diagnosis
              <IconArrowRight size={14} />
            </Link>
          </div>
        )}
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
        {tool.githubUrl ? (
          <a
            href={tool.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            <IconExternalLink size={14} />
            View on GitHub
          </a>
        ) : (
          <button
            disabled
            className="bg-elevated text-text-dim px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-not-allowed"
          >
            <IconExternalLink size={14} />
            View on GitHub
          </button>
        )}
        <Link
          href="/builder/submit"
          className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
        >
          Submit for Diagnosis
          <IconArrowRight size={14} />
        </Link>
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
