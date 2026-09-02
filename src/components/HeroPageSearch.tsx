import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Hero } from '../types';
import { heroIconUrl } from '../lib/assets';

/**
 * A compact search box shown on each hero's dedicated page (DOW-20) — lets
 * you jump straight to another hero without going back to the Heroes index
 * or the main board's hero tray.
 */
export function HeroPageSearch({ heroes }: { heroes: Hero[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return heroes.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 8);
  }, [heroes, query]);

  function goTo(heroSlug: string) {
    navigate(`/heroes/${heroSlug}`);
    setQuery('');
    setOpen(false);
  }

  // A search narrowed to exactly one match jumps there automatically — no
  // need to also click it. Mirrors ItemPickerPopover/HeroPickerPopover's
  // same behavior (DOW-4).
  useEffect(() => {
    if (query.trim() && filtered.length === 1) goTo(filtered[0].slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filtered]);

  return (
    <div
      ref={containerRef}
      className="hero-page-search"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <input
        type="search"
        placeholder="Search heroes…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && filtered.length > 0) goTo(filtered[0].slug);
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        name="dow-hero-page-search"
        data-lpignore="true"
        data-1p-ignore=""
        data-bwignore="true"
        data-form-type="other"
      />
      {open && query.trim() && (
        <div className="hero-page-search-dropdown">
          {filtered.length === 0 && <div className="item-picker-empty">No heroes found.</div>}
          {filtered.map((hero) => (
            <button
              key={hero.slug}
              type="button"
              className="item-picker-item"
              onClick={() => goTo(hero.slug)}
            >
              <img src={heroIconUrl(hero.code)} alt="" draggable={false} />
              <span>{hero.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
