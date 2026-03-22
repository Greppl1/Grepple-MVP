#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ─────────────────────────────────────────────

const SUPABASE_URL = process.env.GREPPLE_SUPABASE_URL || "https://xrbbvkfvwlupfflhzvwu.supabase.co";
const SUPABASE_KEY = process.env.GREPPLE_SUPABASE_KEY || "";
const SCORING_URL = process.env.GREPPLE_SCORING_URL || "https://spirited-success-production-2b55.up.railway.app";

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

// ── Helpers ────────────────────────────────────────────

async function supabaseGet(table, params = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
  return res.json();
}

const CLUSTER_MAP = {
  ai_ml: "AI", database: "Database", dex_swap: "DeFi",
  calendar: "Productivity", cloud_infra: "Cloud", notification: "Communication",
  search: "Search", code_tools: "DevTools", finance_data: "Data",
  file_ops: "DevTools", bridging: "DeFi", web_fetch: "Search",
  docs_productivity: "Productivity", lending: "DeFi", portfolio: "Data",
};

function mapCategory(cluster) {
  return CLUSTER_MAP[cluster] || cluster || "Other";
}

// ── Server ─────────────────────────────────────────────

const server = new McpServer({
  name: "grepple",
  version: "0.1.0",
});

// ── Tool: search_tools ─────────────────────────────────

server.tool(
  "search_tools",
  {
    description: "Search the Grepple registry for MCP tools by keyword, category, or description. Returns scored tools with quality metrics.",
    query: z.string().describe("Search query — tool name, keyword, or task description (e.g. 'swap tokens', 'database query')"),
    category: z.string().optional().describe("Filter by category: AI, Database, DeFi, Productivity, Cloud, Communication, Search, DevTools, Data"),
    limit: z.number().optional().default(10).describe("Max results (default 10, max 50)"),
  },
  async ({ query, category, limit }) => {
    const safeLimit = Math.min(limit || 10, 50);

    // Build Supabase query
    const words = query.trim().split(/\s+/).filter(Boolean);
    const orParts = words.map(w => `tool_name.ilike.%${w}%,tool_description.ilike.%${w}%`).join(",");

    let params = `select=*&or=(${encodeURIComponent(orParts)})&limit=${safeLimit}`;
    if (category) {
      // Reverse-map category to clusters
      const clusters = Object.entries(CLUSTER_MAP)
        .filter(([, cat]) => cat.toLowerCase() === category.toLowerCase())
        .map(([cluster]) => cluster);
      if (clusters.length > 0) {
        params += `&cluster=in.(${clusters.join(",")})`;
      }
    }

    const tools = await supabaseGet("tools_with_repo", params);

    if (!tools.length) {
      return { content: [{ type: "text", text: `No tools found for "${query}".` }] };
    }

    // Get benchmarks for these tools
    const toolNames = tools.map(t => t.tool_name);
    const benchParams = `select=*&tool_name=in.(${toolNames.map(n => `"${n}"`).join(",")})`;
    let benchmarks = [];
    try { benchmarks = await supabaseGet("benchmark_results", benchParams); } catch { /* no benchmarks */ }

    const benchMap = new Map();
    for (const b of benchmarks) {
      if (!benchMap.has(b.tool_name) || b.invoke_rate > benchMap.get(b.tool_name).invoke_rate) {
        benchMap.set(b.tool_name, b);
      }
    }

    const results = tools.map(t => {
      const bench = benchMap.get(t.tool_name);
      const schemaHealth = t.has_schema ? (t.parsed_schema ? 70 : 40) : 0;
      const discoverability = t.tool_description?.length > 50 ? 65 : (t.tool_description ? 35 : 0);
      const successRate = bench && (bench.invoke_rate + bench.error_rate > 0)
        ? Math.round(bench.invoke_rate / (bench.invoke_rate + bench.error_rate) * 100)
        : null;
      const composite = successRate !== null
        ? Math.round(schemaHealth * 0.35 + discoverability * 0.35 + successRate * 0.3)
        : Math.round(schemaHealth * 0.5 + discoverability * 0.5);

      return {
        name: t.tool_name,
        description: t.tool_description || "No description",
        category: mapCategory(t.cluster),
        repo: t.repo_name || null,
        github_url: t.github_url || null,
        scores: {
          composite,
          schema_health: schemaHealth,
          discoverability,
          success_rate: successRate,
        },
        has_schema: !!t.has_schema,
        source_file: t.source_file || null,
      };
    });

    results.sort((a, b) => b.scores.composite - a.scores.composite);

    const text = results.map((t, i) =>
      `${i + 1}. **${t.name}** (${t.scores.composite}/100) — ${t.category}\n   ${t.description}\n   ${t.github_url ? `GitHub: ${t.github_url}` : "No repo"}`
    ).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `Found ${results.length} tools for "${query}":\n\n${text}`,
      }],
    };
  }
);

// ── Tool: get_tool_detail ──────────────────────────────

server.tool(
  "get_tool_detail",
  {
    description: "Get full details for a specific MCP tool, including quality scores, schema, integration guide, and repository info.",
    tool_name: z.string().describe("Exact tool name (e.g. 'swap_token', 'web_search')"),
  },
  async ({ tool_name }) => {
    const tools = await supabaseGet("tools_with_repo", `tool_name=eq.${encodeURIComponent(tool_name)}&limit=1`);

    if (!tools.length) {
      // Try fuzzy match
      const fuzzy = await supabaseGet("tools_with_repo", `tool_name=ilike.%${encodeURIComponent(tool_name)}%&limit=5`);
      if (!fuzzy.length) {
        return { content: [{ type: "text", text: `Tool "${tool_name}" not found in registry.` }] };
      }
      const suggestions = fuzzy.map(t => t.tool_name).join(", ");
      return { content: [{ type: "text", text: `Tool "${tool_name}" not found. Did you mean: ${suggestions}?` }] };
    }

    const tool = tools[0];

    // Get benchmark
    let bench = null;
    try {
      const benchmarks = await supabaseGet("benchmark_results", `tool_name=eq.${encodeURIComponent(tool_name)}&limit=1`);
      if (benchmarks.length) bench = benchmarks[0];
    } catch { /* no benchmark */ }

    // Build detail
    const parts = [];
    parts.push(`# ${tool.tool_name}`);
    parts.push(`**Category:** ${mapCategory(tool.cluster)}`);
    parts.push(`**Description:** ${tool.tool_description || "None"}`);

    if (tool.github_url) parts.push(`**Repository:** ${tool.github_url}`);
    if (tool.repo_name) parts.push(`**Repo:** ${tool.repo_name}`);
    if (tool.source_file) parts.push(`**Source file:** ${tool.source_file}`);

    // Scores
    parts.push("\n## Quality Scores");
    if (bench) {
      parts.push(`- Invoke rate: ${bench.invoke_rate}%`);
      parts.push(`- Error rate: ${bench.error_rate}%`);
      parts.push(`- Mention rate: ${bench.mention_rate}%`);
      if (bench.failure_mode) parts.push(`- Failure mode: ${bench.failure_mode}`);
      if (bench.root_cause) parts.push(`- Root cause: ${bench.root_cause}`);
    } else {
      parts.push("No benchmark data yet.");
    }

    // Schema
    if (tool.parsed_schema) {
      parts.push("\n## Input Schema");
      try {
        const schema = JSON.parse(tool.parsed_schema);
        parts.push("```json\n" + JSON.stringify(schema, null, 2) + "\n```");
      } catch {
        parts.push("Schema could not be parsed.");
      }
    }

    // Integration
    if (tool.github_url) {
      const repoName = tool.repo_name?.split("/").pop() || "mcp-server";
      const sourceFile = tool.source_file || "index.js";
      parts.push("\n## Quick Setup");
      parts.push("```bash");
      parts.push(`git clone ${tool.github_url}`);
      parts.push(`cd ${repoName}`);
      parts.push("npm install && npm start");
      parts.push("```");
      parts.push("\n## MCP Client Config");
      parts.push("```json");
      parts.push(JSON.stringify({
        mcpServers: {
          [repoName]: { command: "node", args: [sourceFile] }
        }
      }, null, 2));
      parts.push("```");
    }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

// ── Tool: diagnose_tool ────────────────────────────────

server.tool(
  "diagnose_tool",
  {
    description: "Submit an MCP tool for quality diagnosis. Returns a report ID that you can use with get_report to check scores. The diagnosis is free and tests schema health + discoverability.",
    name: z.string().describe("Tool name"),
    description: z.string().describe("Tool description — what does it do?"),
    input_schema: z.record(z.any()).optional().describe("JSON schema for the tool's input parameters"),
    server_url: z.string().optional().describe("MCP server URL (optional — without it, only static analysis runs)"),
  },
  async ({ name, description, input_schema, server_url }) => {
    const body = {
      name,
      description,
      inputSchema: input_schema || {},
      serverUrl: server_url || "",
      runLlmTest: true,
    };

    const res = await fetch(`${SCORING_URL}/api/v1/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      return { content: [{ type: "text", text: `Diagnosis failed: ${err}` }] };
    }

    const data = await res.json();
    const reportId = data.reportId || data.report_id;

    if (!reportId) {
      return { content: [{ type: "text", text: "Diagnosis submitted but no report ID returned. The scoring engine may be processing." }] };
    }

    return {
      content: [{
        type: "text",
        text: `Diagnosis submitted for "${name}".\n\nReport ID: ${reportId}\n\nUse get_report("${reportId}") to check the scores.`,
      }],
    };
  }
);

// ── Tool: get_report ───────────────────────────────────

server.tool(
  "get_report",
  {
    description: "Get the quality scores for a previously submitted tool diagnosis. Returns schema health, discoverability, and improvement suggestions.",
    report_id: z.string().describe("Report ID from diagnose_tool"),
  },
  async ({ report_id }) => {
    // Fetch scores
    const scoresRes = await fetch(`${SCORING_URL}/api/v1/report/${report_id}/scores`);
    if (!scoresRes.ok) {
      return { content: [{ type: "text", text: `Report "${report_id}" not found or still processing.` }] };
    }
    const scores = await scoresRes.json();

    const parts = [];
    parts.push(`# Diagnosis Report`);
    parts.push(`**Overall:** ${scores.overall ?? "N/A"}/100 (Grade: ${scores.grade ?? "N/A"})`);

    if (scores.schemaHealth) {
      parts.push(`**Schema Health:** ${scores.schemaHealth.score}/100`);
    }
    if (scores.discoverability) {
      parts.push(`**Discoverability:** ${scores.discoverability.score}/100`);
    }

    // Fetch full report for suggestions
    try {
      const reportRes = await fetch(`${SCORING_URL}/api/v1/report/${report_id}`);
      if (reportRes.ok) {
        const report = await reportRes.json();

        if (report.diagnosis?.issues?.length) {
          parts.push("\n## Issues Found");
          for (const issue of report.diagnosis.issues) {
            parts.push(`- **${issue.code}**: ${issue.detail || issue.message || issue.code}`);
          }
        }

        const rewrite = report.suggestions ?? report.rewriteSuggestion;
        if (rewrite?.suggested) {
          parts.push("\n## Suggested Rewrite");
          parts.push(`**Description:** ${rewrite.suggested}`);
          if (rewrite.rationale) parts.push(`**Why:** ${rewrite.rationale}`);
        }
      }
    } catch { /* no full report */ }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

// ── Tool: list_categories ──────────────────────────────

server.tool(
  "list_categories",
  {
    description: "List all tool categories in the Grepple registry with tool counts.",
  },
  async () => {
    const clusters = await supabaseGet("cluster_summary", "select=*");

    const lines = clusters
      .sort((a, b) => b.tool_count - a.tool_count)
      .map(c => `- **${mapCategory(c.cluster)}** (${c.tool_count} tools)`);

    return {
      content: [{
        type: "text",
        text: `## Grepple Registry Categories\n\n${lines.join("\n")}\n\nTotal: ${clusters.reduce((s, c) => s + c.tool_count, 0)} tools`,
      }],
    };
  }
);

// ── Tool: registry_stats ───────────────────────────────

server.tool(
  "registry_stats",
  {
    description: "Get overall Grepple registry statistics — total tools, repos, benchmarks, and categories.",
  },
  async () => {
    const stats = await supabaseGet("registry_stats", "select=*&limit=1");
    const s = stats[0] || {};

    return {
      content: [{
        type: "text",
        text: [
          "## Grepple Registry Stats",
          `- **${Number(s.total_tools || 0).toLocaleString()}** tools indexed`,
          `- **${Number(s.total_repos || 0)}** repositories`,
          `- **${Number(s.tools_with_schema || 0)}** tools with schema`,
          `- **${Number(s.total_benchmark_results || 0)}** benchmark results`,
          `- **${Number(s.total_clusters || 0)}** categories`,
        ].join("\n"),
      }],
    };
  }
);

// ── Start ──────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
