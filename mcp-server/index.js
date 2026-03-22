#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4-mini";

// ── Config ─────────────────────────────────────────────

const SUPABASE_URL = process.env.GREPPLE_SUPABASE_URL || "https://xrbbvkfvwlupfflhzvwu.supabase.co";
const SUPABASE_KEY = process.env.GREPPLE_SUPABASE_KEY || "";
const SCORING_URL = process.env.GREPPLE_SCORING_URL || "https://spirited-success-production-2b55.up.railway.app";
const BACKEND_URL = process.env.GREPPLE_BACKEND_URL || "https://zian-backend-production.up.railway.app";
const WEBHOOK_API_KEY = process.env.GREPPLE_WEBHOOK_API_KEY || "";

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

async function backendPost(path, body, extraHeaders = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Backend ${path}: ${res.status}`);
  return data;
}

async function backendGet(path, extraHeaders = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: extraHeaders });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Backend ${path}: ${res.status}`);
  return data;
}

const CAT = {
  ai_ml: "AI", database: "Database", dex_swap: "DeFi",
  calendar: "Productivity", cloud_infra: "Cloud", notification: "Communication",
  search: "Search", code_tools: "DevTools", finance_data: "Data",
  file_ops: "DevTools", bridging: "DeFi", web_fetch: "Search",
  docs_productivity: "Productivity", lending: "DeFi", portfolio: "Data",
};
const cat = (c) => CAT[c] || c || "Other";

function toolScore(t, bench) {
  const sh = t.has_schema ? (t.parsed_schema ? 70 : 40) : 0;
  const disc = t.tool_description?.length > 50 ? 65 : (t.tool_description ? 35 : 0);
  const sr = bench && (bench.invoke_rate + bench.error_rate > 0)
    ? Math.round(bench.invoke_rate / (bench.invoke_rate + bench.error_rate) * 100) : null;
  const comp = sr !== null ? Math.round(sh * 0.35 + disc * 0.35 + sr * 0.3) : Math.round(sh * 0.5 + disc * 0.5);
  return { comp, sh, disc, sr };
}

// ── Server ─────────────────────────────────────────────

const server = new McpServer({ name: "grepple", version: "0.2.0" });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REGISTRY — Discovery & Browse
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      const s = toolScore(t, b);
      return { name: t.tool_name, desc: t.tool_description || "No description", cat: cat(t.cluster), github: t.github_url, ...s };
    }).sort((a, b) => b.comp - a.comp);

    const text = results.map((t, i) =>
      `${i + 1}. **${t.name}** (${t.comp}/100) — ${t.cat}\n   ${t.desc}\n   ${t.github || "No repo"}`
    ).join("\n\n");

    return { content: [{ type: "text", text: `Found ${results.length} tools for "${query}":\n\n${text}` }] };
  }
);

// ── browse_tools ───────────────────────────────────────

server.tool(
  "browse_tools",
  "Browse the Grepple registry with pagination. Use to explore available tools without a specific search query. Filter by category and sort by score or name.",
  {
    category: z.optional(z.string()),
    sort_by: z.optional(z.enum(["score", "name", "newest"])),
    page: z.optional(z.number()),
    page_size: z.optional(z.number()),
  },
  async ({ category, sort_by, page, page_size }) => {
    const size = Math.min(page_size || 20, 50);
    const pg = Math.max(page || 1, 1);
    const offset = (pg - 1) * size;

    let params = `select=*&limit=${size}&offset=${offset}`;
    if (category) {
      const clusters = Object.entries(CAT).filter(([, c]) => c.toLowerCase() === category.toLowerCase()).map(([k]) => k);
      if (clusters.length) params += `&cluster=in.(${clusters.join(",")})`;
    }

    const orderCol = sort_by === "name" ? "tool_name" : sort_by === "newest" ? "id" : "tool_name";
    const orderDir = sort_by === "newest" ? "desc" : "asc";
    params += `&order=${orderCol}.${orderDir}`;

    const tools = await sbGet("tools_with_repo", params);
    if (!tools.length) return { content: [{ type: "text", text: `No tools on page ${pg}${category ? ` for category "${category}"` : ""}.` }] };

    const names = tools.map(t => t.tool_name);
    let benchmarks = [];
    try { benchmarks = await sbGet("benchmark_results", `select=*&tool_name=in.(${names.map(n => `"${n}"`).join(",")})`); } catch {}
    const bm = new Map();
    for (const b of benchmarks) {
      if (!bm.has(b.tool_name) || b.invoke_rate > bm.get(b.tool_name).invoke_rate) bm.set(b.tool_name, b);
    }

    let results = tools.map(t => {
      const b = bm.get(t.tool_name);
      const s = toolScore(t, b);
      return { name: t.tool_name, desc: (t.tool_description || "No description").slice(0, 120), cat: cat(t.cluster), ...s };
    });

    if (sort_by === "score") results.sort((a, b) => b.comp - a.comp);

    const text = results.map((t, i) =>
      `${offset + i + 1}. **${t.name}** (${t.comp}/100) — ${t.cat}\n   ${t.desc}`
    ).join("\n\n");

    return { content: [{ type: "text", text: `Page ${pg} (${size}/page):\n\n${text}\n\n_Use page: ${pg + 1} for more results._` }] };
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

// ── compare_tools ──────────────────────────────────────

server.tool(
  "compare_tools",
  "Compare 2-5 MCP tools side by side — scores, categories, schema availability, and benchmark data.",
  { tool_names: z.array(z.string()).check(z.minLength(2)).check(z.maxLength(5)) },
  async ({ tool_names }) => {
    const tools = await sbGet("tools_with_repo", `tool_name=in.(${tool_names.map(n => `"${n}"`).join(",")})&limit=5`);
    if (!tools.length) return { content: [{ type: "text", text: "None of the specified tools were found." }] };

    let benchmarks = [];
    try { benchmarks = await sbGet("benchmark_results", `tool_name=in.(${tool_names.map(n => `"${n}"`).join(",")})`); } catch {}
    const bm = new Map();
    for (const b of benchmarks) {
      if (!bm.has(b.tool_name) || b.invoke_rate > bm.get(b.tool_name).invoke_rate) bm.set(b.tool_name, b);
    }

    const header = `| Tool | Score | Category | Schema | Invoke% | Error% |`;
    const sep = `|------|-------|----------|--------|---------|--------|`;
    const rows = tools.map(t => {
      const b = bm.get(t.tool_name);
      const s = toolScore(t, b);
      return `| ${t.tool_name} | ${s.comp}/100 | ${cat(t.cluster)} | ${t.has_schema ? "Yes" : "No"} | ${b?.invoke_rate ?? "N/A"}% | ${b?.error_rate ?? "N/A"}% |`;
    });

    const missing = tool_names.filter(n => !tools.find(t => t.tool_name === n));
    let footer = "";
    if (missing.length) footer = `\n\n_Not found: ${missing.join(", ")}_`;

    return { content: [{ type: "text", text: `## Tool Comparison\n\n${header}\n${sep}\n${rows.join("\n")}${footer}` }] };
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DIAGNOSIS — Quality Testing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── diagnose_tool ──────────────────────────────────────

server.tool(
  "diagnose_tool",
  "Submit an MCP tool for free quality diagnosis. Real agents test schema health and discoverability. Returns a report with scores and improvement suggestions.",
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

    const p = [`Diagnosis complete for "${name}". Report ID: ${id}`];
    try {
      const sr = await fetch(`${SCORING_URL}/api/v1/report/${id}/scores`);
      if (sr.ok) {
        const scores = await sr.json();
        p.push(`\n**Overall:** ${scores.overall ?? "N/A"}/100 (Grade: ${scores.grade ?? "N/A"})`);
        if (scores.schemaHealth) p.push(`**Schema Health:** ${scores.schemaHealth.score}/100`);
        if (scores.discoverability) p.push(`**Discoverability:** ${scores.discoverability.score}/100`);
      }
      const rr = await fetch(`${SCORING_URL}/api/v1/report/${id}`);
      if (rr.ok) {
        const report = await rr.json();
        if (report.diagnosis?.issues?.length) {
          p.push("\n**Issues:**");
          for (const i of report.diagnosis.issues) p.push(`- ${i.code}: ${i.detail || i.code}`);
        }
        const rw = report.suggestions ?? report.rewriteSuggestion;
        if (rw?.suggested) p.push(`\n**Suggested description:** ${rw.suggested}`);
      }
    } catch { /* scores not ready yet */ }

    p.push("\n_To improve: fix the issues, then call diagnose_tool again._");

    return { content: [{ type: "text", text: p.join("\n") }] };
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

    p.push("\n---\n_To improve: fix the issues above, then call diagnose_tool again with the updated description and schema._");

    return { content: [{ type: "text", text: p.join("\n") }] };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AGENT — Registration & Profile
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── register_agent ─────────────────────────────────────

server.tool(
  "register_agent",
  "Register a new agent wallet on the Grepple platform. Required before the agent can earn rewards.",
  {
    wallet_address: z.string(),
    agent_id: z.string(),
  },
  async ({ wallet_address, agent_id }) => {
    try {
      const data = await backendPost("/api/agents/register", { wallet_address, agent_id });
      return { content: [{ type: "text", text: `Agent registered successfully.\n- Wallet: ${wallet_address}\n- Agent ID: ${agent_id}\n- Tx: ${data.tx_hash || "pending"}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Registration failed: ${e.message}` }] };
    }
  }
);

// ── get_agent_profile ──────────────────────────────────

server.tool(
  "get_agent_profile",
  "Get an agent's profile — wallet, registration status, total earned, task count.",
  { wallet_address: z.string() },
  async ({ wallet_address }) => {
    try {
      const data = await backendGet(`/api/agents/${wallet_address}/profile`);
      const a = data.agent || data;
      const p = [
        `# Agent Profile`,
        `- **Wallet:** ${a.wallet || wallet_address}`,
        `- **Active:** ${a.isActive ?? a.is_active ?? "unknown"}`,
        `- **Total Earned:** ${a.totalEarned ?? a.total_earned ?? 0} tokens`,
        `- **Tasks Completed:** ${a.taskCount ?? a.task_count ?? 0}`,
        `- **Registered:** ${a.registeredAt ?? a.registered_at ?? "unknown"}`,
      ];
      return { content: [{ type: "text", text: p.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to get profile: ${e.message}` }] };
    }
  }
);

// ── get_agent_rewards ──────────────────────────────────

server.tool(
  "get_agent_rewards",
  "Get an agent's complete reward history — all mint records with amounts, tiers, and transaction hashes.",
  { wallet_address: z.string() },
  async ({ wallet_address }) => {
    try {
      const data = await backendGet(`/api/agents/${wallet_address}/rewards`);
      const records = data.mint_records || data.mintRecords || [];
      if (!records.length) return { content: [{ type: "text", text: `No rewards found for ${wallet_address}.` }] };

      const total = data.total_earned || data.totalEarned || "N/A";
      const lines = records.map((r, i) =>
        `${i + 1}. **${r.amount || r.tokenAmount}** tokens (${r.tier}) — Task: ${r.taskHash || r.task_hash || "N/A"} | Tx: ${r.tx_hash || r.txHash || "N/A"}`
      );

      return { content: [{ type: "text", text: `## Rewards for ${wallet_address}\n**Total Earned:** ${total}\n\n${lines.join("\n")}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to get rewards: ${e.message}` }] };
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REWARDS — Minting & Status
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── get_reward_status ──────────────────────────────────

server.tool(
  "get_reward_status",
  "Check the mint/reward status for a specific test task.",
  { task_id: z.string() },
  async ({ task_id }) => {
    try {
      const data = await backendGet(`/api/rewards/status/${encodeURIComponent(task_id)}`);
      const p = [
        `## Reward Status`,
        `- **Task:** ${task_id}`,
        `- **Status:** ${data.mint_status || data.mintStatus || "unknown"}`,
        `- **Mint ID:** ${data.mint_id ?? data.mintId ?? "N/A"}`,
        `- **Amount:** ${data.amount ?? "N/A"}`,
        `- **Tier:** ${data.tier ?? "N/A"}`,
        `- **Tx:** ${data.tx_hash ?? data.txHash ?? "N/A"}`,
      ];
      return { content: [{ type: "text", text: p.join("\n") }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to get status: ${e.message}` }] };
    }
  }
);

// ── submit_test_result ─────────────────────────────────

server.tool(
  "submit_test_result",
  "Submit a test task completion event (simulates Jerry's webhook). Triggers reward minting for the agent. Requires webhook API key.",
  {
    task_id: z.string(),
    agent_wallet: z.string(),
    tool_id: z.string(),
    result: z.enum(["success", "failed_with_diagnosis", "invalid"]),
    call_success: z.optional(z.boolean()),
    structured_report: z.optional(z.boolean()),
  },
  async ({ task_id, agent_wallet, tool_id, result, call_success, structured_report }) => {
    if (!WEBHOOK_API_KEY) {
      return { content: [{ type: "text", text: "GREPPLE_WEBHOOK_API_KEY not configured. Set it to use this tool." }] };
    }

    const body = {
      event: "test_task_completed",
      data: {
        task_id,
        agent_wallet,
        tool_id,
        result,
        scores: {
          call_success: call_success ?? (result === "success"),
          structured_report: structured_report ?? (result !== "invalid"),
        },
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const data = await backendPost("/api/rewards/webhook", body, {
        "x-webhook-key": WEBHOOK_API_KEY,
      });
      return { content: [{ type: "text", text: `Test result submitted.\n- Task: ${task_id}\n- Result: ${result}\n- Mint status: ${data.mint_status || data.status || "processed"}\n- Tx: ${data.tx_hash || "pending"}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Submission failed: ${e.message}` }] };
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  VAULT — Budget & Redemption
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── deposit_usdc ───────────────────────────────────────

server.tool(
  "deposit_usdc",
  "Deposit mock USDC into a builder's vault (testnet). Requires webhook API key.",
  {
    builder_wallet: z.string(),
    usdc_amount: z.string(),
  },
  async ({ builder_wallet, usdc_amount }) => {
    if (!WEBHOOK_API_KEY) {
      return { content: [{ type: "text", text: "GREPPLE_WEBHOOK_API_KEY not configured. Set it to use this tool." }] };
    }

    try {
      const data = await backendPost("/api/vault/deposit", { builder_wallet, usdc_amount }, {
        "x-webhook-key": WEBHOOK_API_KEY,
      });
      return { content: [{ type: "text", text: `Deposit successful.\n- Builder: ${builder_wallet}\n- Amount: ${usdc_amount} USDC\n- New Balance: ${data.new_balance || data.newBalance || "N/A"}\n- Tx: ${data.tx_hash || "pending"}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Deposit failed: ${e.message}` }] };
    }
  }
);

// ── get_balance ────────────────────────────────────────

server.tool(
  "get_balance",
  "Check a builder's USDC vault balance.",
  { wallet_address: z.string() },
  async ({ wallet_address }) => {
    try {
      const data = await backendGet(`/api/vault/balance/${wallet_address}`);
      return {
        content: [{
          type: "text",
          text: `## Vault Balance\n- **Wallet:** ${wallet_address}\n- **Balance:** ${data.balance ?? "0"} USDC\n- **Total Deposited:** ${data.total_deposited ?? data.totalDeposited ?? "N/A"}\n- **Total Consumed:** ${data.total_consumed ?? data.totalConsumed ?? "N/A"}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Failed to get balance: ${e.message}` }] };
    }
  }
);

// ── redeem_tokens ──────────────────────────────────────

server.tool(
  "redeem_tokens",
  "Redeem agent reward tokens for USDC. Requires agent signature authentication. Note: redemption may be disabled on testnet.",
  {
    agent_wallet: z.string(),
    token_amount: z.string(),
    mint_ids: z.array(z.number()),
    signature: z.optional(z.string()),
    message: z.optional(z.string()),
  },
  async ({ agent_wallet, token_amount, mint_ids, signature, message }) => {
    const headers = {};
    if (signature && message) {
      headers["x-agent-signature"] = signature;
      headers["x-agent-message"] = message;
    }

    try {
      const data = await backendPost("/api/vault/redeem", { agent_wallet, token_amount, mint_ids }, headers);
      return { content: [{ type: "text", text: `Redemption processed.\n- USDC received: ${data.usdc_received || data.usdcReceived || "N/A"}\n- Tx: ${data.tx_hash || "pending"}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Redemption failed: ${e.message}` }] };
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PLATFORM — Health & Info
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── platform_status ────────────────────────────────────

server.tool(
  "platform_status",
  "Check the health of all Grepple platform services — backend API, scoring engine, Supabase, and blockchain RPC.",
  {},
  async () => {
    const checks = {};

    // Backend
    try {
      const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json().catch(() => ({}));
      checks.backend = res.ok ? `OK (block: ${data.blockNumber || "?"})` : `DOWN (${res.status})`;
    } catch (e) { checks.backend = `UNREACHABLE (${e.message})`; }

    // Scoring engine
    try {
      const res = await fetch(`${SCORING_URL}/health`, { signal: AbortSignal.timeout(5000) });
      checks.scoring = res.ok ? "OK" : `DOWN (${res.status})`;
    } catch (e) { checks.scoring = `UNREACHABLE (${e.message})`; }

    // Supabase
    try {
      const tools = await sbGet("registry_stats", "select=total_tools&limit=1");
      checks.supabase = `OK (${tools[0]?.total_tools || "?"} tools)`;
    } catch (e) { checks.supabase = `ERROR (${e.message})`; }

    const lines = Object.entries(checks).map(([k, v]) => `- **${k}:** ${v}`);
    const allOk = Object.values(checks).every(v => v.startsWith("OK"));

    return {
      content: [{
        type: "text",
        text: `## Platform Status ${allOk ? "— All Systems Operational" : "— Issues Detected"}\n\n${lines.join("\n")}\n\n**Backend:** ${BACKEND_URL}\n**Scoring:** ${SCORING_URL}`,
      }],
    };
  }
);

// ── Start ──────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
