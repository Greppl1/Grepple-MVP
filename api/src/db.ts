import { Pool } from "pg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export function getPool(): Pool {
  return pool;
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repos (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      github_url TEXT,
      section TEXT,
      cluster TEXT,
      has_any_schema INTEGER DEFAULT 0,
      extraction_method TEXT,
      failure_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS tools (
      id SERIAL PRIMARY KEY,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      tool_name TEXT NOT NULL,
      tool_description TEXT,
      has_schema INTEGER DEFAULT 0,
      parsed_schema TEXT,
      source_file TEXT,
      pattern_type TEXT
    );

    CREATE TABLE IF NOT EXISTS diagnostic_reports (
      id SERIAL PRIMARY KEY,
      tool_id INTEGER NOT NULL REFERENCES tools(id),
      report_id TEXT UNIQUE,
      model_id TEXT,
      failure_mode TEXT,
      invoke_rate INTEGER,
      mention_rate INTEGER,
      silent_rate INTEGER,
      error_rate INTEGER,
      required_field_count INTEGER,
      total_field_count INTEGER,
      nesting_depth INTEGER,
      has_defaults INTEGER,
      full_report TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS benchmark_results (
      id SERIAL PRIMARY KEY,
      tool_name TEXT NOT NULL,
      tool_id_hash TEXT,
      server_name TEXT,
      mcp_server_url TEXT,
      cluster TEXT,
      cluster_pool_size INTEGER,
      model_id TEXT NOT NULL,
      invoke_rate INTEGER,
      mention_rate INTEGER,
      silent_rate INTEGER,
      error_rate INTEGER,
      invoke_count INTEGER,
      mention_count INTEGER,
      silent_count INTEGER,
      error_count INTEGER,
      total_runs INTEGER,
      condition TEXT,
      task_tiers TEXT,
      failure_mode TEXT,
      root_cause TEXT,
      schema_metrics TEXT,
      description_metrics TEXT,
      diagnosis_issues TEXT,
      cross_model_analysis TEXT,
      benchmark_version TEXT,
      temperature REAL,
      runs_per_tier INTEGER,
      executed_at TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Create indexes (IF NOT EXISTS works in PG 9.5+)
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_tools_repo ON tools(repo_id)",
    "CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(tool_name)",
    "CREATE INDEX IF NOT EXISTS idx_repos_cluster ON repos(cluster)",
    "CREATE INDEX IF NOT EXISTS idx_repos_section ON repos(section)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_tool ON benchmark_results(tool_name)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_model ON benchmark_results(model_id)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_cluster ON benchmark_results(cluster)",
    "CREATE INDEX IF NOT EXISTS idx_benchmark_hash ON benchmark_results(tool_id_hash)",
    "CREATE INDEX IF NOT EXISTS idx_diagnostic_tool ON diagnostic_reports(tool_id)",
  ];
  for (const idx of indexes) {
    await pool.query(idx);
  }
}

export async function importToolsJson(): Promise<void> {
  const jsonPath = path.join(__dirname, "..", "data", "tools_with_schema_v3.json");
  if (!fs.existsSync(jsonPath)) {
    console.log("tools_with_schema_v3.json not found, skipping import");
    return;
  }

  const { rows } = await pool.query("SELECT COUNT(*) as c FROM repos");
  if (parseInt(rows[0].c) > 0) {
    console.log(`DB already has ${rows[0].c} repos, skipping import`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  for (const repo of data) {
    const res = await pool.query(
      `INSERT INTO repos (name, description, github_url, section, cluster, has_any_schema, extraction_method, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        repo.name,
        repo.description || null,
        repo.github_url || null,
        repo.section || null,
        repo.cluster || null,
        repo.has_any_schema ? 1 : 0,
        repo.extraction_method || null,
        repo.failure_reason || null,
      ]
    );
    const repoId = res.rows[0].id;

    for (const tool of repo.extracted_tools || []) {
      await pool.query(
        `INSERT INTO tools (repo_id, tool_name, tool_description, has_schema, parsed_schema, source_file, pattern_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          repoId,
          tool.tool_name,
          tool.tool_description || null,
          tool.has_schema ? 1 : 0,
          tool.parsed_schema ? JSON.stringify(tool.parsed_schema) : null,
          tool.source_file || null,
          tool.pattern_type || null,
        ]
      );
    }
  }

  const repoCount = (await pool.query("SELECT COUNT(*) as c FROM repos")).rows[0].c;
  const toolCount = (await pool.query("SELECT COUNT(*) as c FROM tools")).rows[0].c;
  console.log(`Imported ${repoCount} repos, ${toolCount} tools`);
}

export async function importBenchmarkJson(filename: string = "cross_model_benchmark_trial.json"): Promise<void> {
  const jsonPath = path.join(__dirname, "..", "data", filename);
  if (!fs.existsSync(jsonPath)) {
    console.log(`${filename} not found, skipping benchmark import`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const version = data.tools?.[0]?.benchmarkMeta?.benchmarkVersion || "unknown";

  const { rows } = await pool.query(
    "SELECT COUNT(*) as c FROM benchmark_results WHERE benchmark_version = $1",
    [version]
  );
  if (parseInt(rows[0].c) > 0) {
    console.log(`Benchmark ${version} already imported (${rows[0].c} rows), skipping`);
    return;
  }

  for (const tool of data.tools) {
    const models = Object.keys(tool.modelResults || {});
    for (const modelId of models) {
      const mr = tool.modelResults[modelId];
      await pool.query(
        `INSERT INTO benchmark_results (
          tool_name, tool_id_hash, server_name, mcp_server_url, cluster, cluster_pool_size,
          model_id, invoke_rate, mention_rate, silent_rate, error_rate,
          invoke_count, mention_count, silent_count, error_count, total_runs,
          condition, task_tiers, failure_mode, root_cause,
          schema_metrics, description_metrics, diagnosis_issues, cross_model_analysis,
          benchmark_version, temperature, runs_per_tier, executed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
        [
          tool.name,
          tool.toolId,
          tool.serverName || null,
          tool.mcpServerUrl || null,
          tool.cluster || null,
          tool.clusterPoolSize || null,
          modelId,
          mr.invokeRate, mr.mentionRate, mr.silentRate, mr.errorRate,
          mr.invokeCount, mr.mentionCount, mr.silentCount, mr.errorCount, mr.totalRuns,
          mr.condition || null,
          JSON.stringify(mr.taskTiers || null),
          tool.diagnosis?.failureMode || null,
          tool.diagnosis?.rootCause || null,
          tool.schemaMetrics ? JSON.stringify(tool.schemaMetrics) : null,
          tool.descriptionMetrics ? JSON.stringify(tool.descriptionMetrics) : null,
          tool.diagnosis?.issues ? JSON.stringify(tool.diagnosis.issues) : null,
          tool.crossModelAnalysis ? JSON.stringify(tool.crossModelAnalysis) : null,
          tool.benchmarkMeta?.benchmarkVersion || null,
          tool.benchmarkMeta?.temperature ?? null,
          tool.benchmarkMeta?.runsPerTier || null,
          tool.benchmarkMeta?.executedAt || null,
        ]
      );
    }
  }

  const count = (await pool.query("SELECT COUNT(*) as c FROM benchmark_results")).rows[0].c;
  const toolCount = new Set(data.tools.map((t: any) => t.name)).size;
  const modelCount = (await pool.query("SELECT COUNT(DISTINCT model_id) as c FROM benchmark_results")).rows[0].c;
  console.log(`Imported benchmark: ${toolCount} tools x ${modelCount} models = ${count} rows`);
}
