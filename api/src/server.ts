import express from "express";
import cors from "cors";
import { getDb, initDb, importToolsJson, importBenchmarkJson } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

// --- Init DB on startup ---
initDb();
importToolsJson();
importBenchmarkJson();

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// --- Tool list (for Jerry's /api/v1/tools/list) ---
app.get("/api/registry/tools", (req, res) => {
  const db = getDb();
  const { cluster, section, search, has_schema, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];

  if (cluster) {
    where += " AND r.cluster = ?";
    params.push(cluster);
  }
  if (section) {
    where += " AND r.section = ?";
    params.push(section);
  }
  if (has_schema === "true") {
    where += " AND t.has_schema = 1";
  }
  if (search) {
    where += " AND (t.tool_name LIKE ? OR t.tool_description LIKE ? OR r.name LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM tools t JOIN repos r ON t.repo_id = r.id WHERE ${where}
  `).get(...params) as { total: number };

  params.push(Number(limit), Number(offset));

  const tools = db.prepare(`
    SELECT
      t.id,
      t.tool_name,
      t.tool_description,
      t.has_schema,
      t.parsed_schema,
      t.source_file,
      r.name as repo_name,
      r.github_url,
      r.cluster,
      r.section,
      r.description as repo_description
    FROM tools t
    JOIN repos r ON t.repo_id = r.id
    WHERE ${where}
    ORDER BY t.tool_name
    LIMIT ? OFFSET ?
  `).all(...params);

  db.close();

  res.json({
    total: countRow.total,
    limit: Number(limit),
    offset: Number(offset),
    tools: tools.map((t: any) => ({
      ...t,
      parsed_schema: t.parsed_schema ? JSON.parse(t.parsed_schema) : null,
    })),
  });
});

// --- Single tool by name ---
app.get("/api/registry/tools/:toolName", (req, res) => {
  const db = getDb();
  const { toolName } = req.params;

  const tool = db.prepare(`
    SELECT
      t.*,
      r.name as repo_name,
      r.github_url,
      r.cluster,
      r.section,
      r.description as repo_description
    FROM tools t
    JOIN repos r ON t.repo_id = r.id
    WHERE t.tool_name = ?
    LIMIT 1
  `).get(toolName) as any;

  if (!tool) {
    // Try fuzzy match
    const fuzzy = db.prepare(`
      SELECT
        t.*,
        r.name as repo_name,
        r.github_url,
        r.cluster,
        r.section
      FROM tools t
      JOIN repos r ON t.repo_id = r.id
      WHERE t.tool_name LIKE ?
      LIMIT 5
    `).all(`%${toolName}%`);

    db.close();

    if (fuzzy.length === 0) {
      return res.status(404).json({ error: "Tool not found" });
    }
    return res.json({
      exact_match: false,
      suggestions: fuzzy.map((t: any) => ({
        ...t,
        parsed_schema: t.parsed_schema ? JSON.parse(t.parsed_schema) : null,
      })),
    });
  }

  // Get latest diagnostic if exists
  const diagnostic = db.prepare(`
    SELECT * FROM diagnostic_reports WHERE tool_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(tool.id) as any;

  db.close();

  res.json({
    ...tool,
    parsed_schema: tool.parsed_schema ? JSON.parse(tool.parsed_schema) : null,
    latest_diagnostic: diagnostic || null,
  });
});

// --- Clusters list ---
app.get("/api/registry/clusters", (_req, res) => {
  const db = getDb();
  const clusters = db.prepare(`
    SELECT cluster, COUNT(*) as repo_count,
           (SELECT COUNT(*) FROM tools t2 JOIN repos r2 ON t2.repo_id = r2.id WHERE r2.cluster = r.cluster) as tool_count
    FROM repos r
    WHERE cluster IS NOT NULL
    GROUP BY cluster
    ORDER BY tool_count DESC
  `).all();
  db.close();
  res.json({ clusters });
});

// --- Sections list ---
app.get("/api/registry/sections", (_req, res) => {
  const db = getDb();
  const sections = db.prepare(`
    SELECT section, COUNT(*) as repo_count
    FROM repos
    WHERE section IS NOT NULL
    GROUP BY section
    ORDER BY repo_count DESC
  `).all();
  db.close();
  res.json({ sections });
});

// --- Repos list ---
app.get("/api/registry/repos", (req, res) => {
  const db = getDb();
  const { cluster, has_tools, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];

  if (cluster) {
    where += " AND r.cluster = ?";
    params.push(cluster);
  }
  if (has_tools === "true") {
    where += " AND (SELECT COUNT(*) FROM tools t WHERE t.repo_id = r.id) > 0";
  }

  params.push(Number(limit), Number(offset));

  const repos = db.prepare(`
    SELECT r.*,
           (SELECT COUNT(*) FROM tools t WHERE t.repo_id = r.id) as tool_count
    FROM repos r
    WHERE ${where}
    ORDER BY tool_count DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  db.close();
  res.json({ repos });
});

// --- Stats ---
app.get("/api/registry/stats", (_req, res) => {
  const db = getDb();
  const stats = {
    total_repos: (db.prepare("SELECT COUNT(*) as c FROM repos").get() as any).c,
    repos_with_tools: (db.prepare("SELECT COUNT(DISTINCT repo_id) as c FROM tools").get() as any).c,
    total_tools: (db.prepare("SELECT COUNT(*) as c FROM tools").get() as any).c,
    tools_with_schema: (db.prepare("SELECT COUNT(*) as c FROM tools WHERE has_schema = 1").get() as any).c,
    total_clusters: (db.prepare("SELECT COUNT(DISTINCT cluster) as c FROM repos WHERE cluster IS NOT NULL").get() as any).c,
    total_diagnostics: (db.prepare("SELECT COUNT(*) as c FROM diagnostic_reports").get() as any).c,
  };
  db.close();
  res.json(stats);
});

// --- Benchmark results ---
app.get("/api/registry/benchmark", (req, res) => {
  const db = getDb();
  const { tool_name, cluster, model_id, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];

  if (tool_name) { where += " AND b.tool_name = ?"; params.push(tool_name); }
  if (cluster) { where += " AND b.cluster = ?"; params.push(cluster); }
  if (model_id) { where += " AND b.model_id = ?"; params.push(model_id); }

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM benchmark_results b WHERE ${where}`
  ).get(...params) as { total: number };

  params.push(Number(limit), Number(offset));

  const results = db.prepare(`
    SELECT * FROM benchmark_results b WHERE ${where}
    ORDER BY b.tool_name, b.model_id
    LIMIT ? OFFSET ?
  `).all(...params);

  db.close();

  res.json({
    total: countRow.total,
    results: results.map((r: any) => ({
      ...r,
      task_tiers: r.task_tiers ? JSON.parse(r.task_tiers) : null,
      schema_metrics: r.schema_metrics ? JSON.parse(r.schema_metrics) : null,
      description_metrics: r.description_metrics ? JSON.parse(r.description_metrics) : null,
      diagnosis_issues: r.diagnosis_issues ? JSON.parse(r.diagnosis_issues) : null,
      cross_model_analysis: r.cross_model_analysis ? JSON.parse(r.cross_model_analysis) : null,
    })),
  });
});

// --- Benchmark summary per tool (cross-model view) ---
app.get("/api/registry/benchmark/:toolName", (req, res) => {
  const db = getDb();
  const { toolName } = req.params;

  const results = db.prepare(`
    SELECT * FROM benchmark_results WHERE tool_name = ? ORDER BY model_id
  `).all(toolName) as any[];

  if (results.length === 0) {
    db.close();
    return res.status(404).json({ error: "No benchmark data for this tool" });
  }

  const crossModel = results[0].cross_model_analysis
    ? JSON.parse(results[0].cross_model_analysis) : null;

  db.close();

  res.json({
    tool_name: toolName,
    cluster: results[0].cluster,
    failure_mode: results[0].failure_mode,
    cross_model_analysis: crossModel,
    models: results.map((r: any) => ({
      model_id: r.model_id,
      invoke_rate: r.invoke_rate,
      mention_rate: r.mention_rate,
      silent_rate: r.silent_rate,
      error_rate: r.error_rate,
      total_runs: r.total_runs,
      task_tiers: r.task_tiers ? JSON.parse(r.task_tiers) : null,
    })),
    schema_metrics: results[0].schema_metrics ? JSON.parse(results[0].schema_metrics) : null,
    description_metrics: results[0].description_metrics ? JSON.parse(results[0].description_metrics) : null,
    diagnosis_issues: results[0].diagnosis_issues ? JSON.parse(results[0].diagnosis_issues) : null,
  });
});

// --- Submit diagnostic report (Jerry calls this) ---
app.post("/api/registry/score", (req, res) => {
  // Placeholder — will be implemented after full benchmark
  res.status(501).json({ error: "Not yet implemented. Waiting for full benchmark data." });
});

// --- Call record (Zian verification) ---
app.get("/api/registry/call-record/:id", (_req, res) => {
  // Placeholder — will be implemented after call records are generated
  res.status(501).json({ error: "Not yet implemented." });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Registry API running on http://localhost:${PORT}`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/registry/stats`);
  console.log(`  GET  /api/registry/tools?cluster=&section=&search=&has_schema=true&limit=&offset=`);
  console.log(`  GET  /api/registry/tools/:toolName`);
  console.log(`  GET  /api/registry/clusters`);
  console.log(`  GET  /api/registry/sections`);
  console.log(`  GET  /api/registry/repos?cluster=&has_tools=true`);
});
