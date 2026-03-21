'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch } from './Icons';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  category: 'page' | 'tool' | 'action';
}

const STATIC_COMMANDS: CommandItem[] = [
  { id: 'registry', label: 'Registry', description: 'Browse all MCP tools', href: '/registry', category: 'page' },
  { id: 'submit', label: 'Submit Tool', description: 'Submit a new MCP tool for diagnosis', href: '/builder/submit', category: 'page' },
  { id: 'my-tools', label: 'My Tools', description: 'View your published tools', href: '/builder/tools', category: 'page' },
  { id: 'budget', label: 'Budget', description: 'Manage USDC balance', href: '/builder/budget', category: 'page' },
  { id: 'agent-profile', label: 'Agent Profile', description: 'View agent stats and rewards', href: '/agent/profile', category: 'page' },
  { id: 'agent-register', label: 'Register Agent', description: 'Register as a test agent', href: '/agent/register', category: 'page' },
  { id: 'agent-redeem', label: 'Redeem Tokens', description: 'Redeem GREP for USDC', href: '/agent/redeem', category: 'page' },
];

interface CommandPaletteProps {
  tools?: { id: string; name: string; category: string; description: string }[];
}

export default function CommandPalette({ tools = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Build search items
  const allItems = useMemo(() => {
    const toolItems: CommandItem[] = tools.map((t) => ({
      id: `tool-${t.id}`,
      label: t.name,
      description: `${t.category} — ${t.description?.slice(0, 60) || ''}`,
      href: `/registry/${t.id}`,
      category: 'tool' as const,
    }));
    return [...STATIC_COMMANDS, ...toolItems];
  }, [tools]);

  const filtered = useMemo(() => {
    if (!query.trim()) return STATIC_COMMANDS;
    const q = query.toLowerCase();
    return allItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, allItems]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) navigate(item.href);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [filtered, selectedIndex, navigate]
  );

  const categoryLabel = (cat: CommandItem['category']) => {
    if (cat === 'page') return 'Pages';
    if (cat === 'tool') return 'Tools';
    return 'Actions';
  };

  if (!open) return null;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const key = categoryLabel(item.category);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  let globalIndex = 0;

  return (
    <>
      <div className="cmd-backdrop" onClick={() => setOpen(false)} />
      <div className="cmd-panel">
        <div className="bg-surface border border-border-hi rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <IconSearch size={18} className="text-text-dim shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tools, pages..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-text-dim focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-elevated border border-border text-[10px] text-text-dim font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-text-dim text-sm">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-5 py-1.5 text-[10px] font-semibold text-text-dim uppercase tracking-wider">
                    {group}
                  </div>
                  {items.map((item) => {
                    const idx = globalIndex++;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.href)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          idx === selectedIndex
                            ? 'bg-blue/10 text-white'
                            : 'text-text-secondary hover:bg-elevated hover:text-white'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{item.label}</span>
                          {item.description && (
                            <span className="text-xs text-text-dim block truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {idx === selectedIndex && (
                          <kbd className="text-[10px] text-text-dim font-mono">Enter</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border text-[10px] text-text-dim">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">Enter</kbd> select</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}
