import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Command } from 'lucide-react';
import { cn } from './ui/utils';

export default function CommandPalette({ open, onClose, groups }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const flat = useMemo(() => {
    const items = [];
    groups.forEach(group => {
      group.items.forEach(item => {
        items.push({ ...item, group: group.label || 'Generale' });
      });
    });
    return items;
  }, [groups]);

  const filtered = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.group || '').toLowerCase().includes(q)
    );
  }, [flat, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    });
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIdx];
        if (item) {
          navigate(item.to);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIdx, navigate, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Palette */}
      <div
        role="dialog"
        aria-label="Comandi"
        className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border-subtle">
          <Search className="w-5 h-5 text-content-tertiary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cerca pagina o comando…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary outline-none border-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 h-6 text-2xs font-mono text-content-tertiary border border-border rounded bg-surface-2">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="py-10 text-center text-sm text-content-tertiary">
              Nessun risultato per <span className="font-semibold text-content-secondary">"{query}"</span>
            </div>
          ) : (
            grouped.map(([groupName, items]) => (
              <div key={groupName} className="py-1">
                <div className="text-overline px-4 py-1.5">{groupName}</div>
                {items.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  const active = globalIdx === activeIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      data-active={active}
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      onClick={() => { navigate(item.to); onClose(); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 h-10 text-left text-sm transition-colors',
                        active ? 'bg-brand-50 dark:bg-brand-100 text-brand-700 dark:text-brand-500' : 'text-content-secondary hover:bg-surface-2'
                      )}
                    >
                      {Icon && <Icon className="w-4 h-4 shrink-0" />}
                      <span className="flex-1 font-medium">{item.label}</span>
                      {active && <CornerDownLeft className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 h-9 border-t border-border-subtle bg-surface-2 text-2xs text-content-tertiary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1.5 h-5 border border-border rounded bg-surface"><ArrowUp className="w-2.5 h-2.5" /></kbd>
              <kbd className="inline-flex items-center px-1.5 h-5 border border-border rounded bg-surface"><ArrowDown className="w-2.5 h-2.5" /></kbd>
              Naviga
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center px-1.5 h-5 border border-border rounded bg-surface"><CornerDownLeft className="w-2.5 h-2.5" /></kbd>
              Apri
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span className="font-mono">K</span>
          </span>
        </div>
      </div>
    </div>
  );
}
