'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import { IconCopy, IconCheck, IconExternalLink } from '@/components/Icons';

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast('Copied', 'success');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative bg-bg rounded-lg border border-border overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-elevated/50">
          <span className="text-xs text-text-dim font-mono">{label}</span>
          <button onClick={handleCopy} className="text-xs text-text-dim hover:text-white flex items-center gap-1 transition-colors">
            {copied ? <><IconCheck size={12} /> Copied</> : <><IconCopy size={12} /> Copy</>}
          </button>
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-text-secondary overflow-x-auto whitespace-pre">{code}</pre>
      {!label && (
        <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded hover:bg-elevated transition-colors text-text-dim hover:text-white">
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </button>
      )}
    </div>
  );
}

const MCP_CONFIG = `{
  "mcpServers": {
    "grepple": {
      "command": "npx",
      "args": ["-y", "@grepple/mcp-server"],
      "env": {
        "GREPPLE_SUPABASE_KEY": "YOUR_SUPABASE_ANON_KEY"
      }
    }
  }
}`;

const MCP_CONFIG_LOCAL = `{
  "mcpServers": {
    "grepple": {
      "command": "node",
      "args": ["./mcp-server/index.js"],
      "env": {
        "GREPPLE_SUPABASE_KEY": "YOUR_SUPABASE_ANON_KEY"
      }
    }
  }
}`;

const TOOLS_REF = [
  {
    name: 'search_tools',
    params: 'query: string, category?: string, limit?: number',
    desc: 'Search registry by keyword or task. Returns scored tools ranked by quality.',
    example: 'search_tools({ query: "swap tokens", category: "DeFi", limit: 5 })',
  },
  {
    name: 'get_tool_detail',
    params: 'tool_name: string',
    desc: 'Full tool details — scores, schema, repo, setup commands, MCP config.',
    example: 'get_tool_detail({ tool_name: "swap_token" })',
  },
  {
    name: 'diagnose_tool',
    params: 'name: string, description: string, input_schema?: string, server_url?: string',
    desc: 'Submit a tool for free quality diagnosis. Returns report ID.',
    example: 'diagnose_tool({ name: "my_tool", description: "Fetches weather data" })',
  },
  {
    name: 'get_report',
    params: 'report_id: string',
    desc: 'Get diagnosis scores + improvement suggestions.',
    example: 'get_report({ report_id: "abc-123-def" })',
  },
  {
    name: 'list_categories',
    params: '(none)',
    desc: 'All registry categories with tool counts.',
    example: 'list_categories()',
  },
  {
    name: 'registry_stats',
    params: '(none)',
    desc: 'Total tools, repos, benchmarks, categories.',
    example: 'registry_stats()',
  },
];

export default function DevelopersPage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2">
          Grepple for Agents
        </h1>
        <p className="text-text-secondary">
          Connect any AI agent to Grepple&apos;s registry via MCP. Search, diagnose, and discover tools programmatically.
        </p>
      </div>

      {/* ── Claude Integration Demo ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-10">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4A574]/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#D4A574" opacity="0.2"/><circle cx="9.5" cy="9" r="1" fill="#D4A574"/><circle cx="14.5" cy="9" r="1" fill="#D4A574"/><path d="M8.5 14c.83 1.45 2.08 2.5 3.5 2.5s2.67-1.05 3.5-2.5" stroke="#D4A574" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">Claude Desktop</p>
              <p className="text-xs text-text-dim">with Grepple MCP tools connected</p>
            </div>
          </div>
          <span className="text-xs text-green font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            Connected
          </span>
        </div>

        <div className="px-6 py-5 space-y-5 bg-bg/50">
          {/* User message */}
          <div className="flex justify-end">
            <div className="bg-blue/10 border border-blue/20 rounded-2xl rounded-br-md px-4 py-3 max-w-sm">
              <p className="text-sm text-text">Search for the latest AI news and summarize the top 3 results</p>
            </div>
          </div>

          {/* Claude response */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#D4A574]/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A574"><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>
            </div>
            <div className="space-y-3 flex-1 min-w-0">
              <p className="text-sm text-text-secondary">I&apos;ll search for the latest AI news using the Grepple registry&apos;s web search tool.</p>

              {/* Tool call */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-xs font-mono text-green">search_tools</span>
                  <span className="text-xs text-text-dim ml-auto hidden sm:inline">via Grepple Registry</span>
                </div>
                <pre className="px-3 py-2 text-xs font-mono text-text-secondary overflow-x-auto">{`{ "query": "web search", "category": "Search", "limit": 3 }`}</pre>
              </div>

              {/* Tool result */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-bright shrink-0"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span className="text-xs font-mono text-text-dim">Found 3 tools</span>
                  <span className="text-xs text-green ml-auto">Score: 82, 76, 71</span>
                </div>
                <pre className="px-3 py-2 text-xs font-mono text-text-dim overflow-x-auto">{`[
  { "name": "web_search", "score": 82, "category": "Search" },
  { "name": "google_search", "score": 76, "category": "Search" },
  { "name": "brave_search", "score": 71, "category": "Search" }
]`}</pre>
              </div>

              {/* Claude picks best tool and calls it */}
              <p className="text-sm text-text-secondary">Found <strong className="text-text">web_search</strong> (score: 82). Let me use it to get the latest news.</p>

              {/* Second tool call */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-xs font-mono text-green">web_search</span>
                  <span className="text-xs text-text-dim ml-auto hidden sm:inline">score: 82/100 · trusted</span>
                </div>
                <pre className="px-3 py-2 text-xs font-mono text-text-secondary overflow-x-auto">{`{ "query": "latest AI news March 2026", "num_results": 3 }`}</pre>
              </div>

              {/* Response */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-elevated/50 border-b border-border flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-bright shrink-0"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                  <span className="text-xs font-mono text-text-dim">Response — 3 results</span>
                  <span className="text-xs text-green ml-auto">200 OK · 1.2s</span>
                </div>
                <pre className="px-3 py-2 text-xs font-mono text-text-dim overflow-x-auto">{`[
  { "title": "Claude 4.5 Sets New Benchmarks...", "url": "..." },
  { "title": "Open Source AI Models Surpass...", "url": "..." },
  { "title": "AI Agents Now Handle 40% of...", "url": "..." }
]`}</pre>
              </div>

              {/* Summary */}
              <div className="text-sm text-text-secondary leading-relaxed">
                <p>Here are the top 3 AI news stories this week:</p>
                <ol className="mt-2 ml-4 space-y-1.5 list-decimal text-xs">
                  <li><strong className="text-text">Claude 4.5 Sets New Benchmarks</strong> — Anthropic&apos;s latest model achieves state-of-the-art on coding and reasoning tasks...</li>
                  <li><strong className="text-text">Open Source AI Models Surpass GPT-4</strong> — Llama 4 and Mistral Large beat proprietary models on key benchmarks...</li>
                  <li><strong className="text-text">AI Agents Handle 40% of Customer Support</strong> — Enterprise adoption of agentic workflows doubles in Q1 2026...</li>
                </ol>
              </div>

              {/* GREP earned */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green/5 border border-green/15 rounded-lg">
                <span className="text-xs text-green font-medium">+1.0 GREP earned</span>
                <span className="text-xs text-text-dim">· Successful tool call verified on-chain</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border bg-surface/50 flex items-center justify-between">
          <p className="text-xs text-text-dim">
            Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible agent
          </p>
          <Link href="/registry" className="text-xs text-blue hover:underline">
            Browse tools →
          </Link>
        </div>
      </div>

      {/* Quick start */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-text mb-4">Quick Start</h2>
        <p className="text-text-secondary text-sm mb-4">
          Add Grepple to Claude Desktop, Cursor, Windsurf, or any MCP-compatible client:
        </p>
        <CopyBlock code={MCP_CONFIG} label="claude_desktop_config.json / mcp_config.json" />
        <p className="text-xs text-text-dim mt-2">
          Replace <code className="font-mono text-text-secondary">YOUR_SUPABASE_ANON_KEY</code> with your key. See <a href="#env" className="text-blue hover:underline">Environment Variables</a> below.
        </p>
      </section>

      {/* Local setup */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-text mb-4">Local Setup</h2>
        <p className="text-text-secondary text-sm mb-4">
          To run from source:
        </p>
        <CopyBlock code={`git clone https://github.com/Greppl1/Grepple-MVP.git
cd Grepple-MVP/mcp-server
npm install`} label="Terminal" />
        <p className="text-text-secondary text-sm mt-4 mb-4">Then point your MCP client to the local path:</p>
        <CopyBlock code={MCP_CONFIG_LOCAL} label="MCP Config (local)" />
      </section>

      {/* Env vars */}
      <section className="mb-10" id="env">
        <h2 className="text-lg font-bold text-text mb-4">Environment Variables</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-dim text-left">
                <th className="py-2 pr-4 font-medium">Variable</th>
                <th className="py-2 pr-4 font-medium">Required</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-mono text-xs text-text">GREPPLE_SUPABASE_KEY</td>
                <td className="py-3 pr-4">Yes</td>
                <td className="py-3">Supabase anon key for registry queries</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-mono text-xs text-text">GREPPLE_SUPABASE_URL</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Custom Supabase URL (defaults to Grepple&apos;s hosted instance)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-mono text-xs text-text">GREPPLE_SCORING_URL</td>
                <td className="py-3 pr-4">No</td>
                <td className="py-3">Scoring engine URL (defaults to hosted Jerry instance)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Tools reference */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-text mb-4">Available Tools</h2>
        <p className="text-text-secondary text-sm mb-6">
          Once connected, your agent can call these 6 tools:
        </p>
        <div className="space-y-4">
          {TOOLS_REF.map((tool) => (
            <div key={tool.name} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="font-mono text-sm font-bold text-blue-bright">{tool.name}</h3>
              </div>
              <p className="text-sm text-text-secondary mb-2">{tool.desc}</p>
              <p className="text-xs text-text-dim mb-3">
                <span className="text-text-secondary font-medium">Params:</span> <code className="font-mono">{tool.params}</code>
              </p>
              <CopyBlock code={tool.example} />
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-text mb-4">What agents can do</h2>
        <div className="space-y-3">
          {[
            { q: '"Find me a tool to query Postgres databases"', flow: 'search_tools → get_tool_detail → show user the setup commands' },
            { q: '"Is my MCP tool discoverable by agents?"', flow: 'diagnose_tool → get_report → show scores + suggestions' },
            { q: '"Is my MCP tool any good? Fix it for me."', flow: 'diagnose_tool → read issues + suggested rewrite → apply fixes → diagnose_tool again' },
            { q: '"Compare swap tools in DeFi"', flow: 'search_tools(category="DeFi") → get_tool_detail for top 3 → compare scores' },
          ].map((uc) => (
            <div key={uc.q} className="bg-elevated rounded-lg p-4">
              <p className="text-sm text-text font-medium mb-1">{uc.q}</p>
              <p className="text-xs text-text-dim font-mono">{uc.flow}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section>
        <h2 className="text-lg font-bold text-text mb-4">Links</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/Greppl1/Grepple-MVP/tree/Main/mcp-server"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <IconExternalLink size={14} /> Source Code
          </a>
          <a
            href="https://github.com/Greppl1/Grepple-MVP"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-4 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <IconExternalLink size={14} /> GitHub Repo
          </a>
        </div>
      </section>
    </div>
  );
}
