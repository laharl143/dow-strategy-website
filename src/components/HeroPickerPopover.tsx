import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Hero } from '../types';
import { heroIconUrl } from '../lib/assets';
import { usePopoverPlacement } from '../lib/usePopoverPlacement';

const WIDTH = 264;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 320;

/**
 * A small search-and-pick dropdown shown when clicking an empty "Drop hero
 * here" slot — a click alternative to dragging a hero in from the tray.
 * Picking an already-assigned hero relocates it here, same as dragging it.
 *
 * Rendered via a portal straight to <body> with `position: fixed`, same as
 * ItemPickerPopover (DOW-35) — a popover positioned `absolute` inside its
 * role slot can render past the containing scroll area's clipped edge with
 * no way to reach it, regardless of z-index. Portaling escapes that
 * entirely, and the flip/clamp placement math is shared via
 * usePopoverPlacement so it isn't hand-rolled per popover.
 */
export function HeroPickerPopover({
  heroes,
  assignedHeroSlugs,
  anchorRef,
  onPick,
  onClose,
}: {
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  anchorRef: RefObject<HTMLElement | null>;
  onPick: (heroSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const style = usePopoverPlacement({ anchorRef, popoverRef, width: WIDTH, minHeight: MIN_HEIGHT, maxHeightCap: MAX_HEIGHT });

  // Focusing while the popover is still `visibility: hidden` (during the
  // initial off-screen measurement render) is a silent no-op per the DOM
  // spec, so this has to wait for the placement hook to flip it visible
  // rather than running once on mount.
  useEffect(() => {
    if (style.visibility === 'visible') inputRef.current?.focus();
  }, [style.visibility]);

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

  return createPortal(
    <div ref={popoverRef} className="hero-picker-popover" style={style} onClick={(e) => e.stopPropagation()}>
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
    </div>,
    document.body,
  );
}
