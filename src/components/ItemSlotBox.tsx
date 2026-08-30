import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Item } from '../types';
import { useDoubleClick } from '../lib/useDoubleClick';

export function ItemSlotBox({
  id,
  data,
  item,
  onRemove,
  empty,
  backpack,
  circular,
}: {
  id: string;
  data: Record<string, unknown>;
  item: Item | undefined;
  onRemove: () => void;
  empty: string;
  backpack?: boolean;
  circular?: boolean;
}) {
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
        <span className="item-slot-placeholder" />
      )}
    </div>
  );
}
