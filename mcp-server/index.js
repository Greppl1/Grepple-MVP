#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4-mini";

// ── Config ─────────────────────────────────────────────

const SUPABASE_URL = process.env.GREPPLE_SUPABASE_URL || "https://xrbbvkfvwlupfflhzvwu.supabase.co";
const SUPABASE_KEY = process.env.GREPPLE_SUPABASE_KEY || "";
const SCORING_URL = process.env.GREPPLE_SCORING_URL || "https://spirited-success-production-2b55.up.railway.app";

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
  return res.json();
}

const CAT = {
  ai_ml: "AI", database: "Database", dex_swap: "DeFi",
  calendar: "Productivity", cloud_infra: "Cloud", notification: "Communication",
  search: "Search", code_tools: "DevTools", finance_data: "Data",
  file_ops: "DevTools", bridging: "DeFi", web_fetch: "Search",
  docs_productivity: "Productivity", lending: "DeFi", portfolio: "Data",
};
const cat = (c) => CAT[c] || c || "Other";

// ── Server ─────────────────────────────────────────────

const server = new McpServer({ name: "grepple", version: "0.1.0" });

// ── search_tools ───────────────────────────────────────

server.tool(
  "search_tools",
  "Search the Grepple registry for MCP tools by keyword, category, or task description. Returns scored tools ranked by quality.",
  {
    query: z.string(),
    category: z.optional(z.string()),
    limit: z.optional(z.number()),
  },
  async ({ query, category, limit }) => {
    const n = Math.min(limit || 10, 50);
    const words = query.trim().split(/\s+/).filter(Boolean);
    const or = words.map(w => `tool_name.ilike.%${w}%,tool_description.ilike.%${w}%`).join(",");
    let params = `select=*&or=(${encodeURIComponent(or)})&limit=${n}`;
    if (category) {
      const clusters = Object.entries(CAT).filter(([, c]) => c.toLowerCase() === category.toLowerCase()).map(([k]) => k);
      if (clusters.length) params += `&cluster=in.(${clusters.join(",")})`;
    }

    const tools = await sbGet("tools_with_repo", params);
    if (!tools.length) return { content: [{ type: "text", text: `No tools found for "${query}".` }] };

    const names = tools.map(t => t.tool_name);
    let benchmarks = [];
    try { benchmarks = await sbGet("benchmark_results", `select=*&tool_name=in.(${names.map(n => `"${n}"`).join(",")})`); } catch {}

    const bm = new Map();
    for (const b of benchmarks) {
      if (!bm.has(b.tool_name) || b.invoke_rate > bm.get(b.tool_name).invoke_rate) bm.set(b.tool_name, b);
    }

    const results = tools.map(t => {
      const b = bm.get(t.tool_name);
      const sh = t.has_schema ? (t.parsed_schema ? 70 : 40) : 0;
      const disc = t.tool_description?.length > 50 ? 65 : (t.tool_description ? 35 : 0);
      const sr = b && (b.invoke_rate + b.error_rate > 0) ? Math.round(b.invoke_rate / (b.invoke_rate + b.error_rate) * 100) : null;
      const comp = sr !== null ? Math.round(sh * 0.35 + disc * 0.35 + sr * 0.3) : Math.round(sh * 0.5 + disc * 0.5);
      return { name: t.tool_name, desc: t.tool_description || "No description", cat: cat(t.cluster), github: t.github_url, comp, sh, disc, sr };
    }).sort((a, b) => b.comp - a.comp);

    const text = results.map((t, i) =>
      `${i + 1}. **${t.name}** (${t.comp}/100) — ${t.cat}\n   ${t.desc}\n   ${t.github || "No repo"}`
    ).join("\n\n");

    return { content: [{ type: "text", text: `Found ${results.length} tools for "${query}":\n\n${text}` }] };
  }
);

// ── get_tool_detail ────────────────────────────────────

server.tool(
  "get_tool_detail",
  "Get full details for a specific MCP tool — scores, schema, integration guide, and setup commands.",
  { tool_name: z.string() },
  async ({ tool_name }) => {
    let tools = await sbGet("tools_with_repo", `tool_name=eq.${encodeURIComponent(tool_name)}&limit=1`);
    if (!tools.length) {
      const fuzzy = await sbGet("tools_with_repo", `tool_name=ilike.%${encodeURIComponent(tool_name)}%&limit=5`);
      if (!fuzzy.length) return { content: [{ type: "text", text: `Tool "${tool_name}" not found.` }] };
      return { content: [{ type: "text", text: `Not found. Did you mean: ${fuzzy.map(t => t.tool_name).join(", ")}?` }] };
    }

    const t = tools[0];
    let bench = null;
    try { const bs = await sbGet("benchmark_results", `tool_name=eq.${encodeURIComponent(tool_name)}&limit=1`); if (bs.length) bench = bs[0]; } catch {}

    const p = [`# ${t.tool_name}`, `**Category:** ${cat(t.cluster)}`, `**Description:** ${t.tool_description || "None"}`];
    if (t.github_url) p.push(`**GitHub:** ${t.github_url}`);
    if (t.repo_name) p.push(`**Repo:** ${t.repo_name}`);
    if (t.source_file) p.push(`**Source:** ${t.source_file}`);

    p.push("\n## Scores");
    if (bench) {
      p.push(`- Invoke: ${bench.invoke_rate}% | Error: ${bench.error_rate}% | Mention: ${bench.mention_rate}%`);
      if (bench.failure_mode) p.push(`- Failure mode: ${bench.failure_mode}`);
      if (bench.root_cause) p.push(`- Root cause: ${bench.root_cause}`);
    } else p.push("No benchmark data yet.");

    if (t.parsed_schema) {
      p.push("\n## Input Schema");
      try { p.push("```json\n" + JSON.stringify(JSON.parse(t.parsed_schema), null, 2) + "\n```"); } catch { p.push("Unparseable schema."); }
    }

    if (t.github_url) {
      const repo = t.repo_name?.split("/").pop() || "mcp-server";
      const src = t.source_file || "index.js";
      p.push("\n## Quick Setup", "```bash", `git clone ${t.github_url}`, `cd ${repo}`, "npm install && npm start", "```");
      p.push("\n## MCP Config", "```json", JSON.stringify({ mcpServers: { [repo]: { command: "node", args: [src] } } }, null, 2), "```");
    }

    return { content: [{ type: "text", text: p.join("\n") }] };
  }
);

// ── diagnose_tool ──────────────────────────────────────

server.tool(
  "diagnose_tool",
  "Submit an MCP tool for free quality diagnosis. Real agents test schema health and discoverability. Returns a report ID.",
  {
    name: z.string(),
    description: z.string(),
    input_schema: z.optional(z.string()),
    server_url: z.optional(z.string()),
  },
  async ({ name, description, input_schema, server_url }) => {
    let schema = {};
    if (input_schema) try { schema = JSON.parse(input_schema); } catch { return { content: [{ type: "text", text: "Invalid JSON in input_schema." }] }; }

    const res = await fetch(`${SCORING_URL}/api/v1/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, inputSchema: schema, serverUrl: server_url || "", runLlmTest: true }),
    });

    if (!res.ok) return { content: [{ type: "text", text: `Diagnosis failed: ${await res.text().catch(() => res.status)}` }] };
    const data = await res.json();
    const id = data.reportId || data.report_id;
    if (!id) return { content: [{ type: "text", text: "Submitted but no report ID returned." }] };

    return { content: [{ type: "text", text: `Diagnosis submitted for "${name}".\nReport ID: ${id}\n\nUse get_report to check scores.` }] };
  }
);

// ── get_report ─────────────────────────────────────────

server.tool(
  "get_report",
  "Get diagnosis scores and improvement suggestions for a previously submitted tool.",
  { report_id: z.string() },
  async ({ report_id }) => {
    const sr = await fetch(`${SCORING_URL}/api/v1/report/${report_id}/scores`);
    if (!sr.ok) return { content: [{ type: "text", text: `Report "${report_id}" not found.` }] };
    const scores = await sr.json();

    const p = [`# Diagnosis Report`, `**Overall:** ${scores.overall ?? "N/A"}/100 (Grade: ${scores.grade ?? "N/A"})`];
    if (scores.schemaHealth) p.push(`**Schema Health:** ${scores.schemaHealth.score}/100`);
    if (scores.discoverability) p.push(`**Discoverability:** ${scores.discoverability.score}/100`);

    try {
      const rr = await fetch(`${SCORING_URL}/api/v1/report/${report_id}`);
      if (rr.ok) {
        const report = await rr.json();
        if (report.diagnosis?.issues?.length) {
          p.push("\n## Issues");
          for (const i of report.diagnosis.issues) p.push(`- **${i.code}**: ${i.detail || i.code}`);
        }
        const rw = report.suggestions ?? report.rewriteSuggestion;
        if (rw?.suggested) { p.push("\n## Suggested Rewrite", `> ${rw.suggested}`); if (rw.rationale) p.push(`_${rw.rationale}_`); }
      }
    } catch {}

    return { content: [{ type: "text", text: p.join("\n") }] };
  }
);

// ── list_categories ────────────────────────────────────

server.tool("list_categories", "List all tool categories with tool counts.", {}, async () => {
  const clusters = await sbGet("cluster_summary", "select=*");
  const lines = clusters.sort((a, b) => b.tool_count - a.tool_count).map(c => `- **${cat(c.cluster)}** (${c.tool_count} tools)`);
  return { content: [{ type: "text", text: `## Categories\n\n${lines.join("\n")}\n\nTotal: ${clusters.reduce((s, c) => s + c.tool_count, 0)} tools` }] };
});

// ── registry_stats ─────────────────────────────────────

server.tool("registry_stats", "Get overall registry stats — total tools, repos, benchmarks.", {}, async () => {
  const [s] = await sbGet("registry_stats", "select=*&limit=1");
  return {
    content: [{
      type: "text",
      text: `## Grepple Stats\n- **${Number(s?.total_tools || 0).toLocaleString()}** tools\n- **${s?.total_repos || 0}** repos\n- **${s?.tools_with_schema || 0}** with schema\n- **${s?.total_benchmark_results || 0}** benchmarks`,
    }],
  };
});

// ── Start ──────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
