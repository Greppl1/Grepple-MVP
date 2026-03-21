import type { Tool } from './mock-data';

/**
 * Raw types from Supabase tables
 */
export interface SupabaseTool {
  id: number;
  tool_name: string;
  tool_description: string | null;
  has_schema: number;
  parsed_schema: string | null;
  source_file: string | null;
  pattern_type: string | null;
  repo_id: number;
  repo_name: string | null;
  github_url: string | null;
  cluster: string | null;
  section: string | null;
  repo_description: string | null;
}

export interface SupabaseBenchmark {
  id: number;
  tool_name: string;
  tool_id_hash: string | null;
  server_name: string | null;
  model_id: string;
  invoke_rate: number;
  mention_rate: number;
  silent_rate: number;
  error_rate: number;
  invoke_count: number;
  mention_count: number;
  silent_count: number;
  error_count: number;
  total_runs: number;
  failure_mode: string | null;
  root_cause: string | null;
  schema_metrics: string | null;
  description_metrics: string | null;
  cluster: string | null;
  executed_at: string | null;
  created_at: string | null;
}

export interface SupabaseStats {
  total_repos: string;
  repos_with_tools: string;
  total_tools: string;
  tools_with_schema: string;
  total_clusters: string;
  total_diagnostics: string;
  total_benchmark_results: string;
}

export interface ClusterSummary {
  cluster: string;
  tool_count: number;
}

/**
 * Map Supabase cluster names → frontend category labels
 */
const CLUSTER_TO_CATEGORY: Record<string, string> = {
  ai_ml: 'AI',
  database: 'Database',
  dex_swap: 'DeFi',
  calendar: 'Productivity',
  cloud_infra: 'Cloud',
  notification: 'Communication',
  search: 'Search',
  code_tools: 'DevTools',
  finance_data: 'Data',
  file_ops: 'DevTools',
  bridging: 'DeFi',
  web_fetch: 'Search',
  docs_productivity: 'Productivity',
  lending: 'DeFi',
  portfolio: 'Data',
};

export function clusterToCategory(cluster: string | null): string {
  return CLUSTER_TO_CATEGORY[cluster ?? ''] ?? cluster ?? 'Other';
}

/**
 * Compute quality scores from benchmark data.
 * Returns 0-100 scores for each dimension.
 */
function computeScores(bench: SupabaseBenchmark | null) {
  if (!bench) {
    return {
      schemaHealth: 0,
      discoverability: 0,
      callability: 0,
      successRate: 0,
      composite: 0,
    };
  }

  // Schema health: from schema_metrics JSON
  let schemaHealth = 50; // default if no schema data
  if (bench.schema_metrics) {
    try {
      const sm = JSON.parse(bench.schema_metrics);
      const coverage = sm.descriptionCoverage ?? 0;
      const hasSchema = sm.hasSchema ? 20 : 0;
      const ambiguousPenalty = (sm.ambiguousFieldNames?.length ?? 0) * 5;
      const issuesPenalty = (sm.issues?.length ?? 0) * 3;
      schemaHealth = Math.max(0, Math.min(100, hasSchema + coverage * 0.8 - ambiguousPenalty - issuesPenalty));
    } catch { /* use default */ }
  }

  // Discoverability: from description_metrics JSON
  let discoverability = 50;
  if (bench.description_metrics) {
    try {
      const dm = JSON.parse(bench.description_metrics);
      let score = 40; // base
      if (dm.hasActionVerb) score += 20;
      if (dm.hasUseCase) score += 20;
      if (dm.hasExample) score += 10;
      score += (dm.semanticDensity ?? 0) * 10;
      const missingPenalty = (dm.missingElements?.length ?? 0) * 8;
      discoverability = Math.max(0, Math.min(100, score - missingPenalty));
    } catch { /* use default */ }
  }

  // Callability: invoke_rate is already 0-100
  const callability = Math.min(100, bench.invoke_rate ?? 0);

  // Success rate: 100 - error_rate
  const successRate = Math.max(0, 100 - (bench.error_rate ?? 0));

  // Composite: weighted average
  const composite = Math.round(
    schemaHealth * 0.25 +
    discoverability * 0.25 +
    callability * 0.3 +
    successRate * 0.2
  );

  return {
    schemaHealth: Math.round(schemaHealth),
    discoverability: Math.round(discoverability),
    callability: Math.round(callability),
    successRate: Math.round(successRate),
    composite,
  };
}

/**
 * Map a Supabase tool + its benchmark data → frontend Tool interface
 */
export function mapToFrontendTool(
  tool: SupabaseTool,
  benchmark: SupabaseBenchmark | null,
): Tool {
  const scores = computeScores(benchmark);

  return {
    id: String(tool.id),
    name: tool.tool_name,
    category: clusterToCategory(tool.cluster),
    builder: tool.repo_name ?? 'unknown',
    composite: scores.composite,
    metrics: {
      schemaHealth: scores.schemaHealth,
      discoverability: scores.discoverability,
      callability: scores.callability,
      successRate: scores.successRate,
    },
    trend: [], // no historical data yet
    lastTested: benchmark?.executed_at
      ? formatTimeAgo(benchmark.executed_at)
      : 'Never',
    description: tool.tool_description ?? '',
  };
}

function formatTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Map registry_stats → frontend stats
 */
export function mapStats(stats: SupabaseStats) {
  return {
    totalTools: Number(stats.total_tools) || 0,
    toolsWithSchema: Number(stats.tools_with_schema) || 0,
    totalRepos: Number(stats.total_repos) || 0,
    totalBenchmarks: Number(stats.total_benchmark_results) || 0,
  };
}

/**
 * Get unique frontend categories from cluster summaries
 */
export function getCategoriesFromClusters(clusters: ClusterSummary[]): string[] {
  const cats = new Set<string>();
  cats.add('All');
  for (const c of clusters) {
    cats.add(clusterToCategory(c.cluster));
  }
  return Array.from(cats);
}
