'use client';

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRegistry } from '@/hooks/useRegistry';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { IconSearch } from '@/components/Icons';

const ITEMS_PER_PAGE = 30;

const scoreColor = (v: number) =>
  v >= 85 ? 'text-green' : v >= 60 ? 'text-text' : 'text-amber';

const barColor = (v: number) =>
  v >= 85 ? 'bg-green' : v >= 60 ? 'bg-blue' : 'bg-amber';

type SortOption = 'score-desc' | 'score-asc' | 'name-asc' | 'newest';

function MetricInline({ label, value, untested }: { label: string; value: number; untested?: boolean }) {
  if (untested) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs text-text-dim shrink-0">{label}</span>
        <span className="text-xs text-text-dim italic">n/a</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs text-text-dim shrink-0">{label}</span>
      <div className="w-16 h-1.5 rounded-full bg-elevated overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${barColor(value)}`}
          style={{ width: `${value}%`, opacity: 0.8 }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold ${scoreColor(value)}`}>
        {value}
      </span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-4 pt-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RegistryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState<SortOption>('score-desc');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tools, categories, loading, isLive } = useRegistry();

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 250);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory, sort]);

  const filtered = useMemo(() => {
    let result = tools;

    if (activeCategory !== 'All') {
      result = result.filter((t) => t.category === activeCategory);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    const sorted = [...result].sort((a, b) => {
      switch (sort) {
        case 'score-desc':
          return b.composite - a.composite;
        case 'score-asc':
          return a.composite - b.composite;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'newest':
          return 0; // preserve original order (already sorted by most recent from API)
        default:
          return 0;
      }
    });

    return sorted;
  }, [tools, debouncedSearch, activeCategory, sort]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 min-h-screen">
        <div className="mb-6">
          <Skeleton className="h-10 w-full max-w-md mb-4" />
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-44" />
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 min-h-screen page-enter">
      {/* Search */}
      <div className="mb-4">
        <div className="relative w-full md:w-1/2">
          <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search tools by name or description..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-blue transition-colors"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-6 -mx-6 px-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                activeCategory === cat
                  ? 'bg-blue text-white'
                  : 'bg-elevated text-text-secondary hover:text-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary font-medium">
            {filtered.length.toLocaleString()} tools
          </span>
          {isLive ? (
            <span className="inline-flex items-center gap-1 text-xs text-green">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-text-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-text-dim" />
              Demo
            </span>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:border-blue transition-colors cursor-pointer"
        >
          <option value="score-desc">Score: High &rarr; Low</option>
          <option value="score-asc">Score: Low &rarr; High</option>
          <option value="name-asc">Name: A &rarr; Z</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {/* Tool cards */}
      {paged.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paged.map((tool) => (
            <Link
              key={tool.id}
              href={`/registry/${tool.id}`}
              className="bg-surface rounded-xl p-4 card-glow border border-border transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hi block"
            >
              {/* Top row: category + score */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs rounded-full bg-elevated-2 text-text-secondary px-2 py-0.5">
                  {tool.category}
                </span>
                <span className={`text-lg font-mono font-bold ${scoreColor(tool.composite)}`}>
                  {tool.composite}
                </span>
              </div>

              {/* Tool name */}
              <h3 className="text-base font-semibold text-white mb-1 truncate">
                {tool.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-text-secondary mb-3 line-clamp-2 leading-relaxed">
                {tool.description}
              </p>

              {/* Metric bars */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <MetricInline label="Schema" value={tool.metrics.schemaHealth} />
                <MetricInline label="Discover" value={tool.metrics.discoverability} />
                <MetricInline label="Success" value={tool.metrics.successRate} untested={tool.metrics.successRate === 0} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state py-20 text-center">
          <p className="text-text-dim text-sm mb-3">No tools match your search</p>
          <button
            onClick={() => {
              setSearch('');
              setActiveCategory('All');
            }}
            className="text-blue text-sm font-medium hover:text-white transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:border-border-hi text-text-secondary hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:border-border-hi text-text-secondary hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function RegistryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 min-h-screen">
          <Skeleton className="h-10 w-full max-w-md mb-4" />
          <SkeletonGrid />
        </div>
      }
    >
      <RegistryContent />
    </Suspense>
  );
}
