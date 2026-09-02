import { useEffect, useRef, useState } from 'react';
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
  /** Current autocast state. Omit along with onToggleAutocast for slots that
   * don't support it (situational items). */
  autocast?: boolean;
  onToggleAutocast?: () => void;
}) {
  const { open: pickerOpen, openPopover, closePopover } = useSingleOpenPopover(id);
  const { setNodeRef, isOver } = useDroppable({ id, data });
  const slotRef = useRef<HTMLDivElement | null>(null);
  const draggable = useDraggable({
    id: `${id}:occupant`,
    data: { kind: data.kind, fromSlotId: data.slotId, fromItemIndex: data.itemIndex, itemSlug: item?.slug },
    disabled: !item,
  });
  const handleClick = useDoubleClick(onRemove);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    function close() {
      setMenu(null);
    }
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);

  function handleContextMenu(e: React.MouseEvent) {
    if (!onToggleAutocast) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        slotRef.current = node;
      }}
      className="item-slot"
      data-over={isOver || undefined}
      data-filled={!!item || undefined}
      data-backpack={backpack || undefined}
      data-circular={circular || undefined}
      data-autocast={(!!item && autocast) || undefined}
      title={item ? item.name : empty}
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
          {menu &&
            onToggleAutocast &&
            createPortal(
              <div className="hero-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    onToggleAutocast();
                    setMenu(null);
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
