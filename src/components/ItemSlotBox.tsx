import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Item } from '../types';
import { useDoubleClick } from '../lib/useDoubleClick';
import { useSingleOpenPopover } from '../lib/useSingleOpenPopover';
import { ItemPickerPopover } from './ItemPickerPopover';

/** The rotating gold sparkle border shown on a slot with autocast enabled (DOW-9). */
function AutocastGlow() {
  return (
    <div className="autocast-glow" aria-hidden="true">
      <span className="autocast-star" />
      <span className="autocast-star" />
      <span className="autocast-star" />
      <span className="autocast-star" />
      <span className="autocast-star" />
    </div>
  );
}

export function ItemSlotBox({
  id,
  data,
  item,
  items,
  onRemove,
  onPick,
  empty,
  backpack,
  circular,
  tierGlow,
  autocast,
  onToggleAutocast,
}: {
  id: string;
  data: Record<string, unknown>;
  item: Item | undefined;
  items: Item[];
  onRemove: () => void;
  onPick: (itemSlug: string) => void;
  empty: string;
  backpack?: boolean;
  circular?: boolean;
  /** Neutral item tier (1-5) to glow the ring in, when another board slot
   * holds the same tier (DOW-23) — a heads-up that only one can really drop. */
  tierGlow?: number;
  /** Current autocast state. Omit along with onToggleAutocast for slots that
   * don't support it (situational items). */
  autocast?: boolean;
  onToggleAutocast?: () => void;
}) {
  const { open: pickerOpen, openPopover, closePopover } = useSingleOpenPopover(id);
  const { open: menuOpen, openPopover: openMenu, closePopover: closeMenu } = useSingleOpenPopover(`${id}:autocast-menu`);
  const { setNodeRef, isOver } = useDroppable({ id, data });
  const slotRef = useRef<HTMLDivElement | null>(null);
  // A stable callback identity, not an inline arrow — an inline one gets
  // recreated every render, so React detaches/reattaches this ref on every
  // re-render (including the render that opens the popover below). Ref
  // (re)attachment for a fiber runs after its children's own layout effects,
  // so ItemPickerPopover's position-measuring layout effect would sometimes
  // see slotRef.current still null from the detach, stranding the popover
  // off-screen. Only reproduced in production builds, not the dev server.
  const setSlotRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      slotRef.current = node;
    },
    [setNodeRef],
  );
  const draggable = useDraggable({
    id: `${id}:occupant`,
    data: { kind: data.kind, fromSlotId: data.slotId, fromItemIndex: data.itemIndex, itemSlug: item?.slug },
    disabled: !item,
  });
  const handleClick = useDoubleClick(onRemove);
  // Screen position only — visibility comes from the shared single-open-popover
  // hook above, so right-clicking a different slot closes this one instead of
  // stacking on top of it (a right-click isn't a 'click' event, so a plain
  // window-click listener alone never sees it).
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [menuOpen, closeMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    if (!onToggleAutocast) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    openMenu();
  }

  return (
    <div
      ref={setSlotRef}
      className="item-slot"
      data-over={isOver || undefined}
      data-filled={!!item || undefined}
      data-backpack={backpack || undefined}
      data-circular={circular || undefined}
      data-autocast={(!!item && autocast) || undefined}
      data-tier-glow={(!!item && tierGlow) || undefined}
      title={item && tierGlow ? `${item.name} — Tier ${tierGlow}, shared with another slot` : item ? item.name : empty}
    >
      {item ? (
        <>
          {autocast && <AutocastGlow />}
          <span
            ref={draggable.setNodeRef}
            {...draggable.listeners}
            {...draggable.attributes}
            className="item-slot-occupant"
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          >
            {item.iconUrl ? (
              <img className="item-slot-icon" src={item.iconUrl} alt={item.name} draggable={false} />
            ) : (
              item.name.slice(0, 2)
            )}
          </span>
          {menuOpen &&
            menuPos &&
            onToggleAutocast &&
            createPortal(
              <div className="hero-context-menu" style={{ left: menuPos.x, top: menuPos.y }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    onToggleAutocast();
                    closeMenu();
                  }}
                >
                  {autocast ? 'Disable Autocast' : 'Enable Autocast'}
                </button>
              </div>,
              document.body,
            )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="item-slot-empty"
            onClick={(e) => {
              e.stopPropagation();
              openPopover();
            }}
          >
            <span className="item-slot-placeholder" />
          </button>
          {pickerOpen && (
            <ItemPickerPopover
              items={items}
              anchorRef={slotRef}
              onPick={(itemSlug) => {
                onPick(itemSlug);
                closePopover();
              }}
              onClose={closePopover}
            />
          )}
        </>
      )}
    </div>
  );
}
