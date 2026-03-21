'use client';

import { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TOOLS, CATEGORIES, scoreColor, scoreBg } from '@/lib/mock-data';
import Sparkline from '@/components/Sparkline';
import ScoreRing from '@/components/ScoreRing';
import { IconSearch, IconTable, IconGrid } from '@/components/Icons';

type SortKey = 'composite' | 'schemaHealth' | 'discoverability' | 'callability' | 'successRate' | 'name';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={className}>
      <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SortArrow({ direction }: { direction: SortDir }) {
  return (
    <span className="ml-1 inline-flex items-center text-purple">
      {direction === 'desc' ? <ChevronDown /> : <ChevronUp />}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    Search: 'text-blue bg-blue/10 border-blue/20',
    DeFi: 'text-green bg-green/10 border-green/20',
    DevTools: 'text-purple bg-purple/10 border-purple/20',
    Database: 'text-amber bg-amber/10 border-amber/20',
    AI: 'text-lavender bg-lavender/10 border-lavender/20',
    Data: 'text-blue-bright bg-blue-bright/10 border-blue-bright/20',
    Communication: 'text-amber bg-amber/10 border-amber/20',
  };
  const classes = colorMap[category] ?? 'text-text-secondary bg-elevated border-border';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${classes}`}>
      {category}
    </span>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-dim w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreBg(value)}`}
          style={{ width: `${value}%`, opacity: 0.7 }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-7 text-right ${scoreColor(value)}`}>
        {value}
      </span>
    </div>
  );
}

function tableScoreColor(v: number): string {
  if (v >= 85) return 'text-green';
  if (v >= 60) return 'text-white';
  return 'text-amber';
}

function RegistryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState('All');
  const [view, setView] = useState<ViewMode>('table');
  const [sortKey, setSortKey] = useState<SortKey>('composite');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = TOOLS;

    if (activeCategory !== 'All') {
      result = result.filter((t) => t.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    const sorted = [...result].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortKey === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortKey === 'composite') {
        aVal = a.composite;
        bVal = b.composite;
      } else {
        aVal = a.metrics[sortKey];
        bVal = b.metrics[sortKey];
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [search, activeCategory, sortKey, sortDir]);

  const sortableHeader = (label: string, key: SortKey) => (
    <th
      className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center">
        {label}
        {sortKey === key && <SortArrow direction={sortDir} />}
      </span>
    </th>
  );

  return (
    <div className="p-6 lg:p-8 min-h-screen animate-fade-in">
      {/* Testnet demo banner */}
      <div className="testnet-banner mb-6">
        Testnet Demo &mdash; Scores and rankings shown are simulated data
      </div>

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Registry</h1>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-blue transition-colors"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-1 gap-0.5 shrink-0">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded transition-colors ${
                view === 'table' ? 'bg-elevated text-white' : 'text-text-dim hover:text-text'
              }`}
              aria-label="Table view"
            >
              <IconTable size={16} />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded transition-colors ${
                view === 'grid' ? 'bg-elevated text-white' : 'text-text-dim hover:text-text'
              }`}
              aria-label="Grid view"
            >
              <IconGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="relative mb-6">
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-purple/20 text-white border-purple/40'
                  : 'bg-surface text-text-secondary border-border hover:text-white hover:border-border-hi'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="transition-opacity duration-300">
        {view === 'table' ? (
          /* TABLE VIEW */
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-elevated/30">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider w-12">
                      #
                    </th>
                    {sortableHeader('Tool Name', 'name')}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider hidden lg:table-cell">
                      Category
                    </th>
                    {sortableHeader('Score', 'composite')}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider hidden xl:table-cell">
                      7d Trend
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider hidden md:table-cell">
                      Last Tested
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tool, idx) => (
                    <tr
                      key={tool.id}
                      className="border-b border-border/50 row-hover transition-colors"
                    >
                      <td className="px-3 py-3 text-sm font-mono text-text-dim">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/registry/${tool.id}`}
                          className="block group"
                        >
                          <span className="text-sm font-semibold text-white group-hover:text-blue-bright transition-colors">
                            {tool.name}
                          </span>
                          <span className="block text-xs text-text-dim font-mono mt-0.5 lg:hidden">
                            <CategoryBadge category={tool.category} />
                          </span>
                          <span className="block text-xs text-text-dim mt-0.5 truncate max-w-xs">
                            {tool.description.length > 60
                              ? tool.description.slice(0, 60) + '...'
                              : tool.description}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <CategoryBadge category={tool.category} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/registry/${tool.id}`} className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm font-bold ${tableScoreColor(tool.composite)}`}
                          >
                            {tool.composite}
                          </span>
                          <div className="w-16 h-2 rounded-full bg-elevated overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${scoreBg(tool.composite)}`}
                              style={{ width: `${tool.composite}%`, opacity: 0.7 }}
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <Sparkline
                          data={tool.trend}
                          color={tool.composite >= 85 ? '#18DC7E' : tool.composite >= 60 ? '#F5A623' : '#FF4757'}
                          width={80}
                          height={28}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-text-dim whitespace-nowrap hidden md:table-cell">
                        {tool.lastTested}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-text-dim text-sm mb-2">No tools found matching your criteria.</p>
                <button
                  onClick={() => { setSearch(''); setActiveCategory('All'); }}
                  className="text-blue-bright text-sm hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          /* GRID / CARD VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((tool, idx) => (
              <Link
                key={tool.id}
                href={`/registry/${tool.id}`}
                className="h-full flex flex-col bg-surface border border-border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hi card-glow"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-elevated text-xs font-mono font-bold text-text-dim">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-white truncate">{tool.name}</h3>
                    </div>
                    <p className="text-xs text-text-dim font-mono mb-2">{tool.builder}</p>
                    <CategoryBadge category={tool.category} />
                  </div>
                  <div className="shrink-0 ml-3">
                    <ScoreRing score={tool.composite} size={56} />
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex-1 flex flex-col gap-2 mb-4">
                  <MetricBar label="Schema Health" value={tool.metrics.schemaHealth} />
                  <MetricBar label="Discoverability" value={tool.metrics.discoverability} />
                  <MetricBar label="Callability" value={tool.metrics.callability} />
                  <MetricBar label="Success Rate" value={tool.metrics.successRate} />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
                  <Sparkline
                    data={tool.trend}
                    color={tool.composite >= 85 ? '#18DC7E' : tool.composite >= 60 ? '#F5A623' : '#FF4757'}
                    width={72}
                    height={24}
                  />
                  <span className="text-xs text-text-dim">{tool.lastTested}</span>
                </div>
              </Link>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <p className="text-text-dim text-sm mb-2">No tools found matching your criteria.</p>
                <button
                  onClick={() => { setSearch(''); setActiveCategory('All'); }}
                  className="text-blue-bright text-sm hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-text-dim">Loading registry...</div>}>
      <RegistryContent />
    </Suspense>
  );
}
