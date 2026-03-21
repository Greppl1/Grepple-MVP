'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { TOOLS as MOCK_TOOLS, CATEGORIES as MOCK_CATEGORIES } from '@/lib/mock-data';
import type { Tool } from '@/lib/mock-data';
import {
  mapToFrontendTool,
  mapStats,
  getCategoriesFromClusters,
  clusterToCategory,
  type SupabaseTool,
  type SupabaseBenchmark,
  type SupabaseStats,
  type ClusterSummary,
} from '@/lib/registry-adapter';

interface RegistryState {
  tools: Tool[];
  categories: string[];
  stats: {
    totalTools: number;
    avgScore: number;
    totalBuilders: number;
    totalBenchmarks: number;
  };
  loading: boolean;
  error: string | null;
  isLive: boolean; // true = real Supabase data, false = mock
}

/**
 * Fetches registry data from Supabase if configured, otherwise falls back to mock data.
 */
export function useRegistry(): RegistryState {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<string[]>(MOCK_CATEGORIES);
  const [stats, setStats] = useState({
    totalTools: 0,
    avgScore: 0,
    totalBuilders: 0,
    totalBenchmarks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Use mock data
      setTools(MOCK_TOOLS);
      setCategories(MOCK_CATEGORIES);
      setStats({
        totalTools: MOCK_TOOLS.length,
        avgScore: Math.round(MOCK_TOOLS.reduce((s, t) => s + t.composite, 0) / MOCK_TOOLS.length),
        totalBuilders: new Set(MOCK_TOOLS.map((t) => t.builder)).size,
        totalBenchmarks: 0,
      });
      setLoading(false);
      return;
    }

    fetchFromSupabase();
  }, []);

  async function fetchFromSupabase() {
    try {
      setLoading(true);
      const sb = supabase!;

      // Fetch tools + benchmarks + stats + clusters in parallel
      const [toolsRes, benchRes, statsRes, clustersRes] = await Promise.all([
        sb.from('tools_with_repo').select('*').order('tool_name'),
        sb.from('benchmark_results').select('*'),
        sb.from('registry_stats').select('*').single(),
        sb.from('cluster_summary').select('*').order('tool_count', { ascending: false }),
      ]);

      if (toolsRes.error) throw toolsRes.error;
      if (benchRes.error) throw benchRes.error;

      const rawTools = toolsRes.data as SupabaseTool[];
      const rawBenchmarks = benchRes.data as SupabaseBenchmark[];

      // Index benchmarks by tool_name (take the best performing model)
      const benchByTool = new Map<string, SupabaseBenchmark>();
      for (const b of rawBenchmarks) {
        const existing = benchByTool.get(b.tool_name);
        if (!existing || b.invoke_rate > existing.invoke_rate) {
          benchByTool.set(b.tool_name, b);
        }
      }

      // Map to frontend format
      const mapped = rawTools.map((t) =>
        mapToFrontendTool(t, benchByTool.get(t.tool_name) ?? null)
      );

      // Sort by composite score descending
      mapped.sort((a, b) => b.composite - a.composite);

      setTools(mapped);
      setIsLive(true);

      // Categories from clusters
      if (clustersRes.data) {
        setCategories(getCategoriesFromClusters(clustersRes.data as ClusterSummary[]));
      }

      // Stats
      if (statsRes.data) {
        const s = mapStats(statsRes.data as SupabaseStats);
        const avgScore = mapped.length > 0
          ? Math.round(mapped.reduce((sum, t) => sum + t.composite, 0) / mapped.length)
          : 0;
        const uniqueBuilders = new Set(mapped.map((t) => t.builder)).size;
        setStats({
          totalTools: s.totalTools,
          avgScore,
          totalBuilders: uniqueBuilders,
          totalBenchmarks: s.totalBenchmarks,
        });
      }
    } catch (err) {
      console.error('Supabase fetch failed, falling back to mock data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Fallback to mock
      setTools(MOCK_TOOLS);
      setCategories(MOCK_CATEGORIES);
      setStats({
        totalTools: MOCK_TOOLS.length,
        avgScore: Math.round(MOCK_TOOLS.reduce((s, t) => s + t.composite, 0) / MOCK_TOOLS.length),
        totalBuilders: new Set(MOCK_TOOLS.map((t) => t.builder)).size,
        totalBenchmarks: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return { tools, categories, stats, loading, error, isLive };
}

/**
 * Fetch a single tool by ID from Supabase, or fall back to mock data.
 */
export function useToolDetail(id: string) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Mock fallback
      const found = MOCK_TOOLS.find((t) => t.id === id);
      setTool(found ?? null);
      setLoading(false);
      return;
    }

    fetchTool();

    async function fetchTool() {
      try {
        const sb = supabase!;
        const { data: toolData, error: toolErr } = await sb
          .from('tools_with_repo')
          .select('*')
          .eq('id', Number(id))
          .single();

        if (toolErr || !toolData) {
          // Try by name as fallback
          const { data: byName } = await sb
            .from('tools_with_repo')
            .select('*')
            .eq('tool_name', id)
            .single();
          if (!byName) {
            setTool(null);
            setLoading(false);
            return;
          }
          const bench = await fetchBenchmark(sb, byName.tool_name);
          setTool(mapToFrontendTool(byName as SupabaseTool, bench));
        } else {
          const bench = await fetchBenchmark(sb, toolData.tool_name);
          setTool(mapToFrontendTool(toolData as SupabaseTool, bench));
        }
      } catch {
        const found = MOCK_TOOLS.find((t) => t.id === id);
        setTool(found ?? null);
      } finally {
        setLoading(false);
      }
    }
  }, [id]);

  return { tool, loading };
}

async function fetchBenchmark(sb: NonNullable<typeof supabase>, toolName: string): Promise<SupabaseBenchmark | null> {
  const { data } = await sb
    .from('benchmark_results')
    .select('*')
    .eq('tool_name', toolName)
    .order('invoke_rate', { ascending: false })
    .limit(1);
  return (data?.[0] as SupabaseBenchmark) ?? null;
}
