'use client';

import { useState, useMemo } from 'react';
import { TOOLS, CATEGORIES, scoreColor, scoreBg } from '@/lib/mock-data';
import Sparkline from '@/components/Sparkline';
import ScoreRing from '@/components/ScoreRing';

type SortKey = 'composite' | 'schemaHealth' | 'discoverability' | 'callability' | 'successRate' | 'name';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

const STATS = [
  { label: 'Total Tools', value: '1,247', delta: '+38 this week' },
  { label: 'Avg Success Rate', value: '84.2%', delta: '+2.1% vs last week' },
  { label: 'Calls / Week', value: '52.4K', delta: '+12% growth' },
  { label: 'Active Builders', value: '328', delta: '+15 new' },
];

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className={active ? 'text-white' : 'text-text-dim'}
    >
      <rect x="1" y="1" width="16" height="3" rx="0.5" fill="currentColor" />
      <rect x="1" y="7" width="16" height="3" rx="0.5" fill="currentColor" />
      <rect x="1" y="13" width="16" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className={active ? 'text-white' : 'text-text-dim'}
    >
      <rect x="1" y="1" width="7" height="7" rx="1" fill="currentColor" />
      <rect x="10" y="1" width="7" height="7" rx="1" fill="currentColor" />
      <rect x="1" y="10" width="7" height="7" rx="1" fill="currentColor" />
      <rect x="10" y="10" width="7" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}

function SortArrow({ direction }: { direction: SortDir }) {
  return (
    <span className="ml-1 inline-block text-purple text-[10px]">
      {direction === 'desc' ? '\u25BC' : '\u25B2'}
    </span>
  );
}

function ScoreCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-sm font-semibold ${scoreColor(value)}`}>
        {value}
      </span>
      <div className="w-12 h-1.5 rounded-full bg-elevated overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBg(value)}`}
          style={{ width: `${value}%`, opacity: 0.7 }}
        />
      </div>
    </div>
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
      <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
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

export default function RegistryPage() {
  const [search, setSearch] = useState('');
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
      result = result.filter((t) => t.name.toLowerCase().includes(q));
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
    <div className="p-8 min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold gradient-text">Registry</h1>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hi transition-colors"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-1 gap-0.5">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded transition-colors ${
                view === 'table' ? 'bg-elevated' : 'hover:bg-elevated/50'
              }`}
              aria-label="Table view"
            >
              <TableIcon active={view === 'table'} />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded transition-colors ${
                view === 'grid' ? 'bg-elevated' : 'hover:bg-elevated/50'
              }`}
              aria-label="Grid view"
            >
              <GridIcon active={view === 'grid'} />
            </button>
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
              activeCategory === cat
                ? 'bg-purple/20 text-white border-purple/40'
                : 'bg-surface text-text-secondary border-border hover:text-white hover:border-border-hi'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1"
          >
            <span className="text-xs text-text-dim font-medium uppercase tracking-wider">
              {stat.label}
            </span>
            <span className="text-2xl font-bold font-mono text-white">{stat.value}</span>
            <span className="text-xs text-green font-medium">{stat.delta}</span>
          </div>
        ))}
      </div>

      {/* Content area with transition */}
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
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Category
                    </th>
                    {sortableHeader('Composite', 'composite')}
                    {sortableHeader('Schema', 'schemaHealth')}
                    {sortableHeader('Discovery', 'discoverability')}
                    {sortableHeader('Callability', 'callability')}
                    {sortableHeader('Success', 'successRate')}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      7d Trend
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      Last Tested
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tool, idx) => (
                    <tr
                      key={tool.id}
                      className="border-b border-border/50 hover:bg-elevated/50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-3 text-sm font-mono text-text-dim">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">{tool.name}</span>
                          <span className="text-xs text-text-dim font-mono">{tool.builder}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <CategoryBadge category={tool.category} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm font-bold ${scoreColor(tool.composite)}`}
                          >
                            {tool.composite}
                          </span>
                          <div className="w-16 h-2 rounded-full bg-elevated overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreBg(tool.composite)}`}
                              style={{ width: `${tool.composite}%`, opacity: 0.7 }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ScoreCell value={tool.metrics.schemaHealth} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreCell value={tool.metrics.discoverability} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreCell value={tool.metrics.callability} />
                      </td>
                      <td className="px-3 py-3">
                        <ScoreCell value={tool.metrics.successRate} />
                      </td>
                      <td className="px-3 py-3">
                        <Sparkline
                          data={tool.trend}
                          color={tool.composite >= 85 ? '#18DC7E' : tool.composite >= 60 ? '#F5A623' : '#FF4757'}
                          width={80}
                          height={28}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-text-dim whitespace-nowrap">
                        {tool.lastTested}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-text-dim text-sm">No tools found matching your criteria.</p>
              </div>
            )}
          </div>
        ) : (
          /* GRID / CARD VIEW */
          <div className="grid grid-cols-3 gap-5">
            {filtered.map((tool, idx) => (
              <div
                key={tool.id}
                className="h-full flex flex-col bg-surface border border-border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hi"
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

                <button className="mt-3 text-xs font-semibold text-blue hover:text-blue-bright transition-colors text-left">
                  View Details &rarr;
                </button>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-3 py-16 text-center">
                <p className="text-text-dim text-sm">No tools found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
