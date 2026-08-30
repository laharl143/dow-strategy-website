import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Item } from '../types';
import { useDoubleClick } from '../lib/useDoubleClick';
import { useSingleOpenPopover } from '../lib/useSingleOpenPopover';
import { ItemPickerPopover } from './ItemPickerPopover';

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
}) {
  const { open: pickerOpen, openPopover, closePopover } = useSingleOpenPopover(id);
  const { setNodeRef, isOver } = useDroppable({ id, data });
  const draggable = useDraggable({
    id: `${id}:occupant`,
    data: { kind: data.kind, fromSlotId: data.slotId, fromItemIndex: data.itemIndex, itemSlug: item?.slug },
    disabled: !item,
  });
  const handleClick = useDoubleClick(onRemove);

  return (
    <div
      ref={setNodeRef}
      className="item-slot"
      data-over={isOver || undefined}
      data-filled={!!item || undefined}
      data-backpack={backpack || undefined}
      data-circular={circular || undefined}
      title={item ? item.name : empty}
    >
      {item ? (
        <span
          ref={draggable.setNodeRef}
          {...draggable.listeners}
          {...draggable.attributes}
          className="item-slot-occupant"
          onClick={handleClick}
        >
          {item.iconUrl ? (
            <img className="item-slot-icon" src={item.iconUrl} alt={item.name} draggable={false} />
          ) : (
            item.name.slice(0, 2)
          )}
        </span>
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
