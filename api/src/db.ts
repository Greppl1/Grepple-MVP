import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(__dirname, "..", "data", "registry.db");

export function getDb(): Database.Database {
  return new Database(DB_PATH);
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      tool_description TEXT,
      has_schema INTEGER DEFAULT 0,
      parsed_schema TEXT,
      source_file TEXT,
      pattern_type TEXT,
      FOREIGN KEY (repo_id) REFERENCES repos(id)
    );

    CREATE TABLE IF NOT EXISTS diagnostic_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL,
      report_id TEXT UNIQUE,
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
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tools_repo ON tools(repo_id);
    CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(tool_name);
    CREATE INDEX IF NOT EXISTS idx_repos_cluster ON repos(cluster);
    CREATE INDEX IF NOT EXISTS idx_repos_section ON repos(section);
    CREATE INDEX IF NOT EXISTS idx_diagnostic_tool ON diagnostic_reports(tool_id);
  `);

  db.close();
}

export function importToolsJson(): void {
  const jsonPath = path.join(__dirname, "..", "data", "tools_with_schema_v3.json");
  if (!fs.existsSync(jsonPath)) {
    console.log("tools_with_schema_v3.json not found, skipping import");
    return;
  }

  const db = getDb();
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const existingCount = db.prepare("SELECT COUNT(*) as c FROM repos").get() as { c: number };
  if (existingCount.c > 0) {
    console.log(`DB already has ${existingCount.c} repos, skipping import`);
    db.close();
    return;
  }

  const insertRepo = db.prepare(`
    INSERT INTO repos (name, description, github_url, section, cluster, has_any_schema, extraction_method, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTool = db.prepare(`
    INSERT INTO tools (repo_id, tool_name, tool_description, has_schema, parsed_schema, source_file, pattern_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const importAll = db.transaction(() => {
    for (const repo of data) {
      const result = insertRepo.run(
        repo.name,
        repo.description || null,
        repo.github_url || null,
        repo.section || null,
        repo.cluster || null,
        repo.has_any_schema ? 1 : 0,
        repo.extraction_method || null,
        repo.failure_reason || null
      );

      const repoId = result.lastInsertRowid;

      for (const tool of repo.extracted_tools || []) {
        insertTool.run(
          repoId,
          tool.tool_name,
          tool.tool_description || null,
          tool.has_schema ? 1 : 0,
          tool.parsed_schema ? JSON.stringify(tool.parsed_schema) : null,
          tool.source_file || null,
          tool.pattern_type || null
        );
      }
    }
  });

  importAll();

  const repoCount = (db.prepare("SELECT COUNT(*) as c FROM repos").get() as { c: number }).c;
  const toolCount = (db.prepare("SELECT COUNT(*) as c FROM tools").get() as { c: number }).c;
  console.log(`Imported ${repoCount} repos, ${toolCount} tools`);

  db.close();
}
