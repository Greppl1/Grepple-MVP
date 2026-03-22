'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
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
