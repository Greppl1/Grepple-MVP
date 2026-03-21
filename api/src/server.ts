import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { getPool, initDb, importToolsJson, importBenchmarkJson } from "./db";

// --- On-chain Registry config ---
const REGISTRY_PROXY = "0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01";
const BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";
const REGISTRY_ABI = [
  "function getCallRecord(bytes32 _callRecordHash) external view returns (tuple(bytes32 toolId, address agentWallet, bool success, uint64 timestamp, bool exists))",
  "function verifyCallRecord(bytes32 _callRecordHash) external view returns (bool)",
  "function computeCallRecordHash(string callRecordId) external pure returns (bytes32)",
];
const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
const registryContract = new ethers.Contract(REGISTRY_PROXY, REGISTRY_ABI, provider);

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

// --- Receive DiagnosticReport from Jerry's scoring engine ---
app.post("/api/registry/score", async (req, res) => {
  const pool = getPool();
  const report = req.body;

  // Validate required fields
  if (!report.report_id || !report.tool_name || !report.metrics) {
    return res.status(400).json({ error: "Missing required fields: report_id, tool_name, metrics" });
  }

  const m = report.metrics;
  const callability = m.callability || {};
  const schema = m.schema || {};
  const diagnosis = report.diagnosis || {};

  // Calculate rates from raw counts
  const testsRun = callability.tests_run || 1;
  const invokeRate = Math.round(((callability.invoke_count || 0) / testsRun) * 100);
  const mentionRate = Math.round(((callability.mention_count || 0) / testsRun) * 100);
  const silentRate = Math.round(((callability.silent_count || 0) / testsRun) * 100);
  const errorRate = Math.round(((callability.error_count || 0) / testsRun) * 100);

  // Find tool_id by name (nullable — report still stored even if tool not in tools table)
  const toolRes = await pool.query("SELECT id FROM tools WHERE tool_name = $1 LIMIT 1", [report.tool_name]);
  const toolId = toolRes.rows.length > 0 ? toolRes.rows[0].id : null;

  // Check for duplicate report_id
  const existing = await pool.query("SELECT id FROM diagnostic_reports WHERE report_id = $1", [report.report_id]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Report already exists", report_id: report.report_id });
  }

  await pool.query(
    `INSERT INTO diagnostic_reports (
      tool_id, report_id, model_id, failure_mode,
      invoke_rate, mention_rate, silent_rate, error_rate,
      required_field_count, total_field_count, nesting_depth, has_defaults,
      full_report
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      toolId,
      report.report_id,
      report.model_id || null,
      diagnosis.failure_mode || null,
      invokeRate,
      mentionRate,
      silentRate,
      errorRate,
      schema.required_fields ?? null,
      schema.total_fields ?? null,
      schema.nesting_depth ?? null,
      schema.has_defaults ? 1 : 0,
      JSON.stringify(report),
    ]
  );

  res.status(201).json({
    status: "stored",
    report_id: report.report_id,
    tool_name: report.tool_name,
    tool_id: toolId,
    failure_mode: diagnosis.failure_mode || null,
    rates: { invokeRate, mentionRate, silentRate, errorRate },
  });
});

// --- Call record verification (Zian's redemption validation) ---
app.get("/api/registry/call-record/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Determine if id is already a bytes32 hash or a string call_record_id
    let callRecordHash: string;
    if (id.startsWith("0x") && id.length === 66) {
      callRecordHash = id;
    } else {
      callRecordHash = await registryContract.computeCallRecordHash(id);
    }

    // Check on-chain
    const exists = await registryContract.verifyCallRecord(callRecordHash);
    if (!exists) {
      return res.status(404).json({ error: "Call record not found", call_record_hash: callRecordHash });
    }

    const record = await registryContract.getCallRecord(callRecordHash);

    res.json({
      call_record_id: id,
      call_record_hash: callRecordHash,
      tool_id: record.toolId,
      agent_wallet: record.agentWallet,
      call_success: record.success,
      call_timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to query call record", detail: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Registry API running on http://localhost:${PORT}`);
});
