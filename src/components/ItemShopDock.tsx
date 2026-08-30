import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { NeutralItem } from '../types';
import { regularItems, neutralItems, regularItemBySlug, neutralItemBySlug } from '../lib/gameData';
import { ItemShopPanel } from './ItemShopPanel';

interface DragData {
  kind: string;
  itemSlug?: string;
}

/**
 * Wraps reference pages (Heroes index/detail) with the same item shop sidebar,
 * F4 toggle, and collapse handle as the main board — for browsing items while
 * off the board. Items aren't droppable anywhere here; dragging just previews.
 */
export function ItemShopDock({
  children,
  onDragEnd,
}: {
  children: ReactNode;
  /** Called when an item drag ends over a droppable on the page — the board's own drag/drop isn't present here. */
  onDragEnd?: (event: DragEndEvent) => void;
}) {
  const [shopOpen, setShopOpen] = useState(true);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F4') {
        e.preventDefault();
        setShopOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const neutralsByTier = useMemo(() => {
    const map = new Map<number, NeutralItem[]>();
    for (const item of neutralItems) {
      const list = map.get(item.tier) ?? [];
      list.push(item);
      map.set(item.tier, list);
    }
    return map;
  }, []);

  function renderDragOverlay() {
    if (!activeDrag?.itemSlug) return null;
    const item =
      activeDrag.kind === 'neutral-item'
        ? neutralItemBySlug.get(activeDrag.itemSlug)
        : regularItemBySlug.get(activeDrag.itemSlug);
    if (!item) return null;
    return item.iconUrl ? (
      <img className="drag-overlay-item-icon" src={item.iconUrl} alt={item.name} />
    ) : (
      <div className="drag-overlay-item-chip">{item.name}</div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveDrag((e.active.data.current as DragData) ?? null)}
      onDragEnd={(e: DragEndEvent) => {
        setActiveDrag(null);
        onDragEnd?.(e);
      }}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="shop-dock-layout" data-shop-open={shopOpen}>
        <div className="shop-dock-content">{children}</div>
        <aside className="right-panel">
          <ItemShopPanel regularItems={regularItems} neutralsByTier={neutralsByTier} neutralsRemaining={null} />
        </aside>
      </div>

      <button
        type="button"
        className="shop-collapse-handle"
        data-shop-open={shopOpen}
        onClick={() => setShopOpen((v) => !v)}
        title={shopOpen ? 'Hide shop (F4)' : 'Show shop (F4)'}
      >
        <span>{shopOpen ? '›' : '‹'}</span>
        <span className="shop-collapse-handle-label">Shop</span>
        <span className="shop-toggle-hotkey">F4</span>
      </button>

      <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  );
}
