import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../types';

const GAP = 6;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 320;
const WIDTH = 220;

/**
 * A small search-and-pick dropdown shown when clicking an empty item or
 * neutral item slot — a click alternative to dragging an item in from the
 * shop. Mirrors HeroPickerPopover's behavior.
 *
 * Rendered via a portal straight to <body> with `position: fixed`, same as
 * HeroContextMenu — an item slot's own z-index only wins within its local
 * stacking context, so a popover positioned absolute inside a slot can still
 * end up underneath a later sibling slot (e.g. the neutral slot) even with a
 * high z-index. Portaling escapes that entirely.
 */
export function ItemPickerPopover({
  items,
  anchorRef,
  onPick,
  onClose,
}: {
  items: Item[];
  anchorRef: RefObject<HTMLElement | null>;
  onPick: (itemSlug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Positioned off-screen until the layout effect below measures the
  // anchor and the popover's natural size, then places it for real —
  // avoids a flash at the wrong spot before that measurement runs.
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: -9999, visibility: 'hidden' });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const naturalHeight = popover.getBoundingClientRect().height;
    const sectionRect = anchor.closest('section')?.getBoundingClientRect();

    const belowLimit = Math.min(sectionRect?.bottom ?? Infinity, window.innerHeight);
    const aboveLimit = Math.max(sectionRect?.top ?? 0, 0);
    const spaceBelow = belowLimit - anchorRect.bottom - GAP;
    const spaceAbove = anchorRect.top - aboveLimit - GAP;

    let top: number;
    let maxHeight = MAX_HEIGHT;
    if (naturalHeight > spaceBelow && spaceAbove > spaceBelow) {
      maxHeight = Math.max(MIN_HEIGHT, Math.min(naturalHeight, spaceAbove));
      top = anchorRect.top - GAP - maxHeight;
    } else {
      if (naturalHeight > spaceBelow) maxHeight = Math.max(MIN_HEIGHT, Math.min(naturalHeight, spaceBelow));
      top = anchorRect.bottom + GAP;
    }

    const left = Math.min(anchorRect.left, window.innerWidth - WIDTH - GAP);

    setStyle({ top, left: Math.max(GAP, left), maxHeight, visibility: 'visible' });
  }, [anchorRef]);

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

  return createPortal(
    <div ref={popoverRef} className="item-picker-popover" style={style} onClick={(e) => e.stopPropagation()}>
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
    </div>,
    document.body,
  );
}
