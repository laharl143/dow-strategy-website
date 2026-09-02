import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hero } from '../types';
import { heroIconUrl } from '../lib/assets';

/**
 * A small search-and-pick dropdown shown when clicking an empty "Drop hero
 * here" slot — a click alternative to dragging a hero in from the tray.
 * Picking an already-assigned hero relocates it here, same as dragging it.
 */
export function HeroPickerPopover({
  heroes,
  assignedHeroSlugs,
  onPick,
  onClose,
}: {
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  onPick: (heroSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleWindowClick() {
      onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleWindowClick);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter((h) => h.name.toLowerCase().includes(q));
  }, [heroes, query]);

  // A search narrowed to exactly one match is picked automatically — no
  // need to also click it. Only while actively searching: with an empty
  // query `filtered` is just the full roster, and picking whichever hero
  // happens to be first (or the entire roster if it's length 1) would be
  // wrong. Mirrors ItemPickerPopover's same behavior (DOW-4).
  useEffect(() => {
    if (query.trim() && filtered.length === 1) onPick(filtered[0].slug);
  }, [query, filtered, onPick]);

  return (
    <div className="hero-picker-popover" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search heroes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        name="dow-hero-search"
        data-lpignore="true"
        data-1p-ignore=""
        data-bwignore="true"
        data-form-type="other"
      />
      <div className="hero-picker-grid" data-single={filtered.length === 1 || undefined}>
        {filtered.length === 0 && <div className="hero-picker-empty">No heroes found.</div>}
        {filtered.map((hero) => (
          <button
            key={hero.slug}
            type="button"
            className="hero-picker-item"
            data-assigned={assignedHeroSlugs.has(hero.slug) || undefined}
            title={assignedHeroSlugs.has(hero.slug) ? `${hero.name} — already on the board, picking moves it here` : hero.name}
            onClick={() => onPick(hero.slug)}
          >
            <img src={heroIconUrl(hero.code)} alt={hero.name} draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
