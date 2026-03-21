import express from "express";
import cors from "cors";
import { getPool, initDb, importToolsJson, importBenchmarkJson } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

// --- Init DB on startup ---
(async () => {
  await initDb();
  await importToolsJson();
  await importBenchmarkJson();
  console.log("DB ready");
})();

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", db: "postgresql" });
});

// --- Tool list ---
app.get("/api/registry/tools", async (req, res) => {
  const pool = getPool();
  const { cluster, section, search, has_schema, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];
  let paramIdx = 1;

  if (cluster) { where += ` AND r.cluster = $${paramIdx++}`; params.push(cluster); }
  if (section) { where += ` AND r.section = $${paramIdx++}`; params.push(section); }
  if (has_schema === "true") { where += " AND t.has_schema = 1"; }
  if (search) {
    where += ` AND (t.tool_name ILIKE $${paramIdx} OR t.tool_description ILIKE $${paramIdx} OR r.name ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  const countRes = await pool.query(
    `SELECT COUNT(*) as total FROM tools t JOIN repos r ON t.repo_id = r.id WHERE ${where}`, params
  );

  const dataParams = [...params, Number(limit), Number(offset)];
  const tools = await pool.query(
    `SELECT t.id, t.tool_name, t.tool_description, t.has_schema, t.parsed_schema, t.source_file,
            r.name as repo_name, r.github_url, r.cluster, r.section, r.description as repo_description
     FROM tools t JOIN repos r ON t.repo_id = r.id
     WHERE ${where} ORDER BY t.tool_name LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    dataParams
  );

  res.json({
    total: parseInt(countRes.rows[0].total),
    limit: Number(limit),
    offset: Number(offset),
    tools: tools.rows.map((t: any) => ({
      ...t,
      parsed_schema: t.parsed_schema ? JSON.parse(t.parsed_schema) : null,
    })),
  });
});

// --- Single tool by name ---
app.get("/api/registry/tools/:toolName", async (req, res) => {
  const pool = getPool();
  const { toolName } = req.params;

  const { rows } = await pool.query(
    `SELECT t.*, r.name as repo_name, r.github_url, r.cluster, r.section, r.description as repo_description
     FROM tools t JOIN repos r ON t.repo_id = r.id WHERE t.tool_name = $1 LIMIT 1`,
    [toolName]
  );

  if (rows.length === 0) {
    const fuzzy = await pool.query(
      `SELECT t.*, r.name as repo_name, r.github_url, r.cluster, r.section
       FROM tools t JOIN repos r ON t.repo_id = r.id WHERE t.tool_name ILIKE $1 LIMIT 5`,
      [`%${toolName}%`]
    );
    if (fuzzy.rows.length === 0) return res.status(404).json({ error: "Tool not found" });
    return res.json({
      exact_match: false,
      suggestions: fuzzy.rows.map((t: any) => ({ ...t, parsed_schema: t.parsed_schema ? JSON.parse(t.parsed_schema) : null })),
    });
  }

  const tool = rows[0];
  const diag = await pool.query(
    "SELECT * FROM diagnostic_reports WHERE tool_id = $1 ORDER BY created_at DESC LIMIT 1",
    [tool.id]
  );

  res.json({
    ...tool,
    parsed_schema: tool.parsed_schema ? JSON.parse(tool.parsed_schema) : null,
    latest_diagnostic: diag.rows[0] || null,
  });
});

// --- Clusters ---
app.get("/api/registry/clusters", async (_req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT r.cluster, COUNT(DISTINCT r.id) as repo_count,
           (SELECT COUNT(*) FROM tools t2 JOIN repos r2 ON t2.repo_id = r2.id WHERE r2.cluster = r.cluster) as tool_count
    FROM repos r WHERE r.cluster IS NOT NULL
    GROUP BY r.cluster ORDER BY tool_count DESC
  `);
  res.json({ clusters: rows });
});

// --- Sections ---
app.get("/api/registry/sections", async (_req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT section, COUNT(*) as repo_count FROM repos WHERE section IS NOT NULL GROUP BY section ORDER BY repo_count DESC"
  );
  res.json({ sections: rows });
});

// --- Repos ---
app.get("/api/registry/repos", async (req, res) => {
  const pool = getPool();
  const { cluster, has_tools, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];
  let paramIdx = 1;

  if (cluster) { where += ` AND r.cluster = $${paramIdx++}`; params.push(cluster); }
  if (has_tools === "true") { where += " AND (SELECT COUNT(*) FROM tools t WHERE t.repo_id = r.id) > 0"; }

  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(
    `SELECT r.*, (SELECT COUNT(*) FROM tools t WHERE t.repo_id = r.id) as tool_count
     FROM repos r WHERE ${where} ORDER BY tool_count DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );
  res.json({ repos: rows });
});

// --- Stats ---
app.get("/api/registry/stats", async (_req, res) => {
  const pool = getPool();
  const stats = {
    total_repos: parseInt((await pool.query("SELECT COUNT(*) as c FROM repos")).rows[0].c),
    repos_with_tools: parseInt((await pool.query("SELECT COUNT(DISTINCT repo_id) as c FROM tools")).rows[0].c),
    total_tools: parseInt((await pool.query("SELECT COUNT(*) as c FROM tools")).rows[0].c),
    tools_with_schema: parseInt((await pool.query("SELECT COUNT(*) as c FROM tools WHERE has_schema = 1")).rows[0].c),
    total_clusters: parseInt((await pool.query("SELECT COUNT(DISTINCT cluster) as c FROM repos WHERE cluster IS NOT NULL")).rows[0].c),
    total_diagnostics: parseInt((await pool.query("SELECT COUNT(*) as c FROM diagnostic_reports")).rows[0].c),
    total_benchmark_results: parseInt((await pool.query("SELECT COUNT(*) as c FROM benchmark_results")).rows[0].c),
  };
  res.json(stats);
});

// --- Benchmark results ---
app.get("/api/registry/benchmark", async (req, res) => {
  const pool = getPool();
  const { tool_name, cluster, model_id, limit = "50", offset = "0" } = req.query;

  let where = "1=1";
  const params: any[] = [];
  let paramIdx = 1;

  if (tool_name) { where += ` AND b.tool_name = $${paramIdx++}`; params.push(tool_name); }
  if (cluster) { where += ` AND b.cluster = $${paramIdx++}`; params.push(cluster); }
  if (model_id) { where += ` AND b.model_id = $${paramIdx++}`; params.push(model_id); }

  const countRes = await pool.query(
    `SELECT COUNT(*) as total FROM benchmark_results b WHERE ${where}`, params
  );

  params.push(Number(limit), Number(offset));
  const { rows } = await pool.query(
    `SELECT * FROM benchmark_results b WHERE ${where} ORDER BY b.tool_name, b.model_id LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params
  );

  res.json({
    total: parseInt(countRes.rows[0].total),
    results: rows.map((r: any) => ({
      ...r,
      task_tiers: r.task_tiers ? JSON.parse(r.task_tiers) : null,
      schema_metrics: r.schema_metrics ? JSON.parse(r.schema_metrics) : null,
      description_metrics: r.description_metrics ? JSON.parse(r.description_metrics) : null,
      diagnosis_issues: r.diagnosis_issues ? JSON.parse(r.diagnosis_issues) : null,
      cross_model_analysis: r.cross_model_analysis ? JSON.parse(r.cross_model_analysis) : null,
    })),
  });
});

// --- Benchmark per tool ---
app.get("/api/registry/benchmark/:toolName", async (req, res) => {
  const pool = getPool();
  const { toolName } = req.params;

  const { rows } = await pool.query(
    "SELECT * FROM benchmark_results WHERE tool_name = $1 ORDER BY model_id",
    [toolName]
  );

  if (rows.length === 0) return res.status(404).json({ error: "No benchmark data for this tool" });

  const crossModel = rows[0].cross_model_analysis ? JSON.parse(rows[0].cross_model_analysis) : null;

  res.json({
    tool_name: toolName,
    cluster: rows[0].cluster,
    failure_mode: rows[0].failure_mode,
    cross_model_analysis: crossModel,
    models: rows.map((r: any) => ({
      model_id: r.model_id,
      invoke_rate: r.invoke_rate,
      mention_rate: r.mention_rate,
      silent_rate: r.silent_rate,
      error_rate: r.error_rate,
      total_runs: r.total_runs,
      task_tiers: r.task_tiers ? JSON.parse(r.task_tiers) : null,
    })),
    schema_metrics: rows[0].schema_metrics ? JSON.parse(rows[0].schema_metrics) : null,
    description_metrics: rows[0].description_metrics ? JSON.parse(rows[0].description_metrics) : null,
    diagnosis_issues: rows[0].diagnosis_issues ? JSON.parse(rows[0].diagnosis_issues) : null,
  });
});

// --- Placeholders ---
app.post("/api/registry/score", (_req, res) => {
  res.status(501).json({ error: "Not yet implemented." });
});

app.get("/api/registry/call-record/:id", (_req, res) => {
  res.status(501).json({ error: "Not yet implemented." });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Registry API running on http://localhost:${PORT}`);
});
