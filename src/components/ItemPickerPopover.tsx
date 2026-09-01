import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../types';

/**
 * A small search-and-pick dropdown shown when clicking an empty item or
 * neutral item slot — a click alternative to dragging an item in from the
 * shop. Mirrors HeroPickerPopover's behavior.
 */
export function ItemPickerPopover({
  items,
  onPick,
  onClose,
}: {
  items: Item[];
  onPick: (itemSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // The hero page stacks item grids and the notes box tightly inside their
  // own <section>, so a slot near the bottom of a grid opens a popover that
  // runs past its section (or the viewport) and over whatever's below it.
  // Flip to whichever side of the slot has more room, and cap the height to
  // that room so the list scrolls internally instead of overflowing either
  // way — a plain flip isn't enough when neither side has a full 320px.
  const [openUpward, setOpenUpward] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    const slotEl = el?.parentElement;
    if (!el || !slotEl) return;

    const GAP = 6;
    const MIN_HEIGHT = 160;
    const naturalHeight = el.getBoundingClientRect().height;
    const slotRect = slotEl.getBoundingClientRect();
    const sectionRect = el.closest('section')?.getBoundingClientRect();

    const belowLimit = Math.min(sectionRect?.bottom ?? Infinity, window.innerHeight);
    const aboveLimit = Math.max(sectionRect?.top ?? 0, 0);
    const spaceBelow = belowLimit - slotRect.bottom - GAP;
    const spaceAbove = slotRect.top - aboveLimit - GAP;

    if (naturalHeight <= spaceBelow) return;

    if (spaceAbove > spaceBelow) {
      setOpenUpward(true);
      setMaxHeight(Math.max(MIN_HEIGHT, Math.min(naturalHeight, spaceAbove)));
    } else {
      setMaxHeight(Math.max(MIN_HEIGHT, Math.min(naturalHeight, spaceBelow)));
    }
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
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div
      ref={popoverRef}
      className="item-picker-popover"
      data-open-upward={openUpward || undefined}
      style={maxHeight ? { maxHeight } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="item-picker-list">
        {filtered.length === 0 && <div className="item-picker-empty">No items found.</div>}
        {filtered.map((item) => (
          <button
            key={item.slug}
            type="button"
            className="item-picker-item"
            title={item.name}
            onClick={() => onPick(item.slug)}
          >
            {item.iconUrl ? (
              <img src={item.iconUrl} alt="" draggable={false} />
            ) : (
              <span className="item-picker-item-fallback">{item.name.slice(0, 2)}</span>
            )}
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
