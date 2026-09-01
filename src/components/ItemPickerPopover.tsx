import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Item, NeutralItem } from '../types';

function isNeutralItem(item: Item): item is NeutralItem {
  return 'tier' in item;
}

const GAP = 6;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 320;
const WIDTH = 220;
// Wider and taller than the named-list sizing — the neutral picker's 5-tier
// accordion (plus its larger icon-only grid once a tier is open) needs more
// room than a flat named list to avoid feeling cramped.
const NEUTRAL_WIDTH = 268;
const NEUTRAL_MIN_HEIGHT = 260;
const NEUTRAL_MAX_HEIGHT = 440;

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
  const [openTiers, setOpenTiers] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Neutral items are numerous but visually distinct by icon, so the picker
  // drops the name label and packs them into an icon-only wrapping grid;
  // other item lists keep the name since they're a much more varied set.
  const isNeutralPicker = items.length > 0 && items.every(isNeutralItem);
  const width = isNeutralPicker ? NEUTRAL_WIDTH : WIDTH;
  const minHeight = isNeutralPicker ? NEUTRAL_MIN_HEIGHT : MIN_HEIGHT;
  const maxHeightCap = isNeutralPicker ? NEUTRAL_MAX_HEIGHT : MAX_HEIGHT;
  // Positioned off-screen until the layout effect below measures the
  // anchor and the popover's natural size, then places it for real —
  // avoids a flash at the wrong spot before that measurement runs. `width`
  // is set from the start (not just after measuring) so that measurement
  // itself reflects the icon-only grid's actual final width.
  const [style, setStyle] = useState<CSSProperties>({ top: -9999, left: -9999, width, visibility: 'hidden' });

  // Focusing while the popover is still `visibility: hidden` (during the
  // initial off-screen measurement render) is a silent no-op per the DOM
  // spec, so this has to wait for the layout effect below to flip it
  // visible rather than running once on mount.
  useEffect(() => {
    if (style.visibility === 'visible') inputRef.current?.focus();
  }, [style.visibility]);

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

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight = maxHeightCap;
    if (naturalHeight > spaceBelow && spaceAbove > spaceBelow) {
      maxHeight = Math.max(minHeight, Math.min(naturalHeight, spaceAbove));
      // Anchor by `bottom`, not `top` — max-height is just a cap, so the box
      // often renders shorter than it (e.g. a collapsed accordion). Anchoring
      // by `top` assuming the box fills maxHeight leaves its actual bottom
      // edge floating short of the slot; `bottom` stays pinned regardless of
      // how tall the box actually ends up.
      bottom = window.innerHeight - anchorRect.top + GAP;
    } else {
      if (naturalHeight > spaceBelow) maxHeight = Math.max(minHeight, Math.min(naturalHeight, spaceBelow));
      top = anchorRect.bottom + GAP;
    }

    const left = Math.min(anchorRect.left, window.innerWidth - width - GAP);

    setStyle({ top, bottom, left: Math.max(GAP, left), width, maxHeight, visibility: 'visible' });
  }, [anchorRef, width, minHeight, maxHeightCap]);

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

  // A search narrowed to exactly one match is picked automatically — no
  // need to also click it. Only while actively searching: with an empty
  // query `filtered` is just the full catalog, and picking whichever one
  // item happens to be first (or the entire catalog if it's length 1) would
  // be wrong.
  useEffect(() => {
    if (query.trim() && filtered.length === 1) onPick(filtered[0].slug);
  }, [query, filtered, onPick]);

  // Neutral items get grouped into a per-tier accordion instead of one long
  // flat list — but only while browsing unfiltered; a search query flattens
  // back to a plain filtered list so matches from every tier stay visible.
  const tierGroups = useMemo(() => {
    if (query.trim() || items.length === 0 || !items.every(isNeutralItem)) return null;
    const groups = new Map<number, NeutralItem[]>();
    for (const item of items as NeutralItem[]) {
      if (!groups.has(item.tier)) groups.set(item.tier, []);
      groups.get(item.tier)!.push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [items, query]);

  function toggleTier(tier: number) {
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  function renderItemButton(item: Item) {
    return (
      <button
        key={item.slug}
        type="button"
        className="item-picker-item"
        data-icon-only={isNeutralPicker || undefined}
        title={item.name}
        onClick={() => onPick(item.slug)}
      >
        {item.iconUrl ? (
          <img src={item.iconUrl} alt="" draggable={false} />
        ) : (
          <span className="item-picker-item-fallback">{item.name.slice(0, 2)}</span>
        )}
        {!isNeutralPicker && <span>{item.name}</span>}
      </button>
    );
  }

  return createPortal(
    <div ref={popoverRef} className="item-picker-popover" style={style} onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search items…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tierGroups ? (
        <div className="item-picker-list item-picker-accordion">
          {tierGroups.map(([tier, tierItems]) => {
            const open = openTiers.has(tier);
            return (
              <div key={tier} className="item-picker-tier">
                <button
                  type="button"
                  className="item-picker-tier-header"
                  aria-expanded={open}
                  onClick={() => toggleTier(tier)}
                >
                  <span>Tier {tier}</span>
                  <span className="item-picker-tier-caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className="item-picker-tier-items" data-icon-only>
                    {tierItems.map(renderItemButton)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="item-picker-list" data-icon-only={isNeutralPicker || undefined}>
          {filtered.length === 0 && <div className="item-picker-empty">No items found.</div>}
          {filtered.map(renderItemButton)}
        </div>
      )}
    </div>,
    document.body,
  );
}
