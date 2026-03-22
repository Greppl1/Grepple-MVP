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

      {/* ── Claude-style Demo: Two Flows ── */}
      <div className="mb-12 space-y-6">

        {/* Flow 1: Builder diagnoses tool */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-bright">Flow 1 — Builder diagnoses a tool</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-[#d5d0c8] shadow-lg">
            {/* Claude-style header */}
            <div className="bg-[#F5F0E8] px-5 py-3 flex items-center gap-3 border-b border-[#e5dfd6]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28CA41]" />
              </div>
              <span className="text-xs text-[#8B7E6A] font-medium ml-2">Claude — with Grepple MCP</span>
            </div>

            <div className="bg-[#FAF8F5] px-6 py-6 space-y-5">
              {/* User */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#5436DA] flex items-center justify-center shrink-0 text-white text-xs font-bold">Z</div>
                <div>
                  <p className="text-[13px] text-[#2D2B28] leading-relaxed">I built an MCP tool called <strong>swap_tokens</strong> — can you check if it&apos;s good enough for agents to use?</p>
                </div>
              </div>

              {/* Claude */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#D4A574] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>
                </div>
                <div className="space-y-3 flex-1 min-w-0">
                  <p className="text-[13px] text-[#2D2B28] leading-relaxed">I&apos;ll run a diagnostic on your tool using Grepple.</p>

                  {/* Tool call block — claude style */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                      <span className="text-xs font-mono text-[#8B7E6A]">diagnose_tool</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`{
  "name": "swap_tokens",
  "description": "Swap ERC-20 tokens on Uniswap V3",
  "input_schema": "{ \\"token_in\\": ..., \\"token_out\\": ... }"
}`}</pre>
                  </div>

                  {/* Result */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28CA41" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                      <span className="text-xs font-mono text-[#6B6560]">Report ready</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`{ "reportId": "7a3f...c91e", "overall": 68, "grade": "C" }`}</pre>
                  </div>

                  {/* Claude second call */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                      <span className="text-xs font-mono text-[#8B7E6A]">get_report</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`{ "report_id": "7a3f...c91e" }`}</pre>
                  </div>

                  {/* Claude summary */}
                  <div className="text-[13px] text-[#2D2B28] leading-relaxed space-y-2">
                    <p>Your tool scored <strong>68/100 (C grade)</strong>. Here&apos;s the breakdown:</p>
                    <div className="bg-[#F5F0E8] rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[#6B6560]">Schema Health</span><span className="font-mono font-bold text-[#28CA41]">85</span></div>
                      <div className="flex justify-between text-xs"><span className="text-[#6B6560]">Discoverability</span><span className="font-mono font-bold text-[#E5A100]">51</span></div>
                    </div>
                    <p><strong>Issues found:</strong></p>
                    <ul className="ml-4 space-y-1 text-xs list-disc text-[#6B6560]">
                      <li><span className="text-[#E5484D]">HIGH</span> — Missing &quot;Use this when...&quot; pattern in description</li>
                      <li><span className="text-[#E5A100]">MED</span> — No usage example for agents to reference</li>
                    </ul>
                    <p>Fix the description and re-run <code className="bg-[#F0EBE3] px-1 py-0.5 rounded text-xs font-mono">diagnose_tool</code> to improve your score.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flow 2: Agent discovers + earns */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-green">Flow 2 — Agent discovers tools &amp; earns</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-[#d5d0c8] shadow-lg">
            <div className="bg-[#F5F0E8] px-5 py-3 flex items-center gap-3 border-b border-[#e5dfd6]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28CA41]" />
              </div>
              <span className="text-xs text-[#8B7E6A] font-medium ml-2">Claude — with Grepple MCP</span>
            </div>

            <div className="bg-[#FAF8F5] px-6 py-6 space-y-5">
              {/* User */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#5436DA] flex items-center justify-center shrink-0 text-white text-xs font-bold">Z</div>
                <p className="text-[13px] text-[#2D2B28] leading-relaxed">I want to swap tokens on Uniswap. Find me the best tool and do it.</p>
              </div>

              {/* Claude */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#D4A574] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg>
                </div>
                <div className="space-y-3 flex-1 min-w-0">
                  <p className="text-[13px] text-[#2D2B28] leading-relaxed">Let me search Grepple&apos;s registry for DeFi swap tools.</p>

                  {/* search_tools */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                      <span className="text-xs font-mono text-[#8B7E6A]">search_tools</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`{ "query": "swap tokens uniswap", "category": "DeFi" }`}</pre>
                  </div>

                  {/* Results */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28CA41" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                      <span className="text-xs font-mono text-[#6B6560]">3 tools found</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`[
  { "name": "swap_token",   "score": 78, "trust": "✓ verified" },
  { "name": "uniswap_v3",   "score": 72, "trust": "✓ open source" },
  { "name": "dex_swap",     "score": 65, "trust": "⚠ unverified" }
]`}</pre>
                  </div>

                  <p className="text-[13px] text-[#2D2B28] leading-relaxed">Found <strong>swap_token</strong> (score 78, verified). I&apos;ll get the details and execute the swap.</p>

                  {/* get_tool_detail */}
                  <div className="rounded-lg border border-[#E5DFD6] overflow-hidden">
                    <div className="bg-[#F0EBE3] px-3 py-1.5 flex items-center gap-2 border-b border-[#E5DFD6]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
                      <span className="text-xs font-mono text-[#8B7E6A]">get_tool_detail</span>
                    </div>
                    <pre className="bg-[#FDFCFA] px-3 py-2 text-xs font-mono text-[#6B6560] overflow-x-auto">{`{ "tool_name": "swap_token" }`}</pre>
                  </div>

                  {/* Claude explains and executes */}
                  <div className="text-[13px] text-[#2D2B28] leading-relaxed space-y-2">
                    <p>The tool is from <strong>rhein1/defi-mcp-server</strong> (open source, 82 stars). Here&apos;s what I did:</p>
                    <div className="bg-[#F5F0E8] rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2"><span className="text-[#28CA41]">✓</span> Connected to swap_token MCP server</div>
                      <div className="flex items-center gap-2"><span className="text-[#28CA41]">✓</span> Called with params: ETH → USDC, 0.5 ETH</div>
                      <div className="flex items-center gap-2"><span className="text-[#28CA41]">✓</span> Received valid response — swap quote: 1,247.50 USDC</div>
                      <div className="flex items-center gap-2"><span className="text-[#28CA41]">✓</span> Call verified on-chain (BSC Testnet)</div>
                    </div>
                    <p>Swap quote ready: <strong>0.5 ETH → 1,247.50 USDC</strong> via Uniswap V3.</p>
                  </div>

                  {/* GREP earned — claude style */}
                  <div className="bg-[#F0F9F1] border border-[#B4DFC4] rounded-lg px-3 py-2 inline-flex items-center gap-2">
                    <span className="text-xs font-medium text-[#1A7F37]">+1.5 GREP earned</span>
                    <span className="text-xs text-[#6B6560]">· FULL tier — successful call + structured report</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
