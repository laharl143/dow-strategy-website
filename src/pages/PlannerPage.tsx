import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Board as BoardType, NeutralItem, SavedStrategy } from '../types';
import { heroIconUrl } from '../lib/assets';
import { heroes, regularItems, neutralItems, heroBySlug, regularItemBySlug, neutralItemBySlug } from '../lib/gameData';
import {
  canAssignNeutral,
  countAssignedNeutrals,
  moveHero,
  setHero,
  setNeutralItem,
  setRegularItem,
  toggleScepter,
  toggleShard,
} from '../lib/boardRules';
import { NEUTRAL_ITEM_CAP } from '../lib/boardRules';
import { loadHeroItemLoadouts } from '../lib/persistence';
import { Board } from '../components/Board';
import { HeroTray } from '../components/HeroTray';
import { ItemShopPanel } from '../components/ItemShopPanel';
import { StrategyList } from '../components/StrategyList';

interface DragData {
  kind: string;
  slotId?: string;
  itemIndex?: number;
  heroSlug?: string;
  itemSlug?: string;
  fromSlotId?: string;
  fromItemIndex?: number;
}

export function PlannerPage({
  board,
  setBoard,
  strategies,
  activeStrategyId,
  onSaveActive,
  onLoad,
  onRename,
  onDelete,
}: {
  board: BoardType;
  setBoard: (updater: (prev: BoardType) => BoardType) => void;
  strategies: SavedStrategy[];
  activeStrategyId: string | null;
  onSaveActive: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [shopOpen, setShopOpen] = useState(true);
  const [heroPanelOpen, setHeroPanelOpen] = useState(true);
  // Require a small drag distance before a pointer-down counts as a drag —
  // otherwise dnd-kit treats any real click (with its inevitable sub-pixel
  // jitter) as a micro-drag and swallows the trailing click event, breaking
  // double-click-to-remove on hero/item slots.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // F4 toggles the item shop panel, matching the in-game shop hotkey.
  // Space toggles the hero panel — guarded against text inputs (search
  // boxes, strategy name) where Space is just... a space.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F4') {
        e.preventDefault();
        setShopOpen((v) => !v);
        return;
      }
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isTyping) return;
        e.preventDefault();
        setHeroPanelOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const assignedHeroSlugs = useMemo(
    () => new Set(board.slots.map((s) => s.heroSlug).filter((s): s is string => !!s)),
    [board],
  );

  const neutralsByTier = useMemo(() => {
    const map = new Map<number, NeutralItem[]>();
    for (const item of neutralItems) {
      const list = map.get(item.tier) ?? [];
      list.push(item);
      map.set(item.tier, list);
    }
    return map;
  }, []);

  const neutralsRemaining = NEUTRAL_ITEM_CAP - countAssignedNeutrals(board);

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;
    if (!activeData || !overData) return;

    setBoard((prev) => {
      // Placing a hero from the tray. If that hero has a saved "Core Items"
      // build from its hero page, seed the slot's items with it.
      if (activeData.kind === 'hero' && overData.kind === 'hero-slot' && overData.slotId) {
        const heroSlug = activeData.heroSlug ?? null;

        // A hero can only be on the board once. If it's already in a
        // different slot, this drag relocates it (and everything it's
        // holding) rather than creating a duplicate.
        const existingSlot = heroSlug ? prev.slots.find((s) => s.heroSlug === heroSlug) : undefined;
        if (existingSlot && existingSlot.slotId !== overData.slotId) {
          return moveHero(prev, existingSlot.slotId, overData.slotId);
        }
        if (existingSlot) return prev;

        const saved = heroSlug ? loadHeroItemLoadouts()[heroSlug] : undefined;
        const hasSavedItems = saved && (saved.regularItemSlugs.some((s) => s !== null) || saved.neutralItemSlug !== null);
        return setHero(prev, overData.slotId, heroSlug, hasSavedItems ? saved : undefined);
      }

      // Moving/swapping a hero already on the board to another role slot.
      if (
        activeData.kind === 'hero-slot' &&
        overData.kind === 'hero-slot' &&
        activeData.fromSlotId &&
        overData.slotId
      ) {
        return moveHero(prev, activeData.fromSlotId, overData.slotId);
      }

      // Placing a regular item from the tray.
      if (
        activeData.kind === 'regular-item' &&
        overData.kind === 'regular-item-slot' &&
        overData.slotId &&
        overData.itemIndex !== undefined
      ) {
        return setRegularItem(prev, overData.slotId, overData.itemIndex, activeData.itemSlug ?? null);
      }

      // Placing a neutral item from the tray.
      if (activeData.kind === 'neutral-item' && overData.kind === 'neutral-item-slot' && overData.slotId) {
        if (!activeData.itemSlug) return prev;
        if (!canAssignNeutral(prev, overData.slotId)) return prev;
        return setNeutralItem(prev, overData.slotId, activeData.itemSlug);
      }

      // Moving a regular item already on the board to another regular slot.
      if (
        activeData.kind === 'regular-item-slot' &&
        overData.kind === 'regular-item-slot' &&
        activeData.fromSlotId &&
        activeData.fromItemIndex !== undefined &&
        overData.slotId &&
        overData.itemIndex !== undefined
      ) {
        const withoutOld = setRegularItem(prev, activeData.fromSlotId, activeData.fromItemIndex, null);
        return setRegularItem(withoutOld, overData.slotId, overData.itemIndex, activeData.itemSlug ?? null);
      }

      // Moving a neutral item already on the board to another hero's neutral slot.
      if (
        activeData.kind === 'neutral-item-slot' &&
        overData.kind === 'neutral-item-slot' &&
        activeData.fromSlotId &&
        overData.slotId
      ) {
        const withoutOld = setNeutralItem(prev, activeData.fromSlotId, null);
        if (!canAssignNeutral(withoutOld, overData.slotId)) return prev;
        return setNeutralItem(withoutOld, overData.slotId, activeData.itemSlug ?? null);
      }

      return prev;
    });
  }

  function renderDragOverlay() {
    if (!activeDrag) return null;

    if ((activeDrag.kind === 'hero' || activeDrag.kind === 'hero-slot') && activeDrag.heroSlug) {
      const hero = heroBySlug.get(activeDrag.heroSlug);
      if (!hero) return null;
      return <img className="drag-overlay-hero-icon" src={heroIconUrl(hero.code)} alt={hero.name} />;
    }

    if (
      (activeDrag.kind === 'regular-item' || activeDrag.kind === 'regular-item-slot') &&
      activeDrag.itemSlug
    ) {
      const item = regularItemBySlug.get(activeDrag.itemSlug);
      if (!item) return null;
      return item.iconUrl ? (
        <img className="drag-overlay-item-icon" src={item.iconUrl} alt={item.name} />
      ) : (
        <div className="drag-overlay-item-chip">{item.name}</div>
      );
    }

    if (
      (activeDrag.kind === 'neutral-item' || activeDrag.kind === 'neutral-item-slot') &&
      activeDrag.itemSlug
    ) {
      const item = neutralItemBySlug.get(activeDrag.itemSlug);
      if (!item) return null;
      return item.iconUrl ? (
        <img className="drag-overlay-item-icon" src={item.iconUrl} alt={item.name} />
      ) : (
        <div className="drag-overlay-item-chip">{item.name}</div>
      );
    }

    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="app-layout" data-shop-open={shopOpen} data-hero-panel-open={heroPanelOpen}>
        <aside className="left-panel">
          <HeroTray heroes={heroes} assignedSlugs={assignedHeroSlugs} />
        </aside>

        <main className="board-panel">
          <Board
            board={board}
            heroBySlug={heroBySlug}
            regularItemBySlug={regularItemBySlug}
            neutralItemBySlug={neutralItemBySlug}
            onRemoveHero={(slotId) => setBoard((prev) => setHero(prev, slotId, null))}
            onRemoveRegularItem={(slotId, i) => setBoard((prev) => setRegularItem(prev, slotId, i, null))}
            onRemoveNeutralItem={(slotId) => setBoard((prev) => setNeutralItem(prev, slotId, null))}
            onToggleScepter={(slotId) => setBoard((prev) => toggleScepter(prev, slotId))}
            onToggleShard={(slotId) => setBoard((prev) => toggleShard(prev, slotId))}
          />
        </main>

        <aside className="right-panel">
          <ItemShopPanel
            regularItems={regularItems}
            neutralsByTier={neutralsByTier}
            neutralsRemaining={neutralsRemaining}
          />
          {strategies.length > 0 && (
            <StrategyList
              strategies={strategies}
              activeStrategyId={activeStrategyId}
              onSaveActive={onSaveActive}
              onLoad={onLoad}
              onRename={onRename}
              onDelete={onDelete}
            />
          )}
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

      <button
        type="button"
        className="hero-panel-collapse-handle"
        data-hero-panel-open={heroPanelOpen}
        onClick={() => setHeroPanelOpen((v) => !v)}
        title={heroPanelOpen ? 'Hide heroes (Space)' : 'Show heroes (Space)'}
      >
        <span>{heroPanelOpen ? '‹' : '›'}</span>
        <span className="hero-panel-collapse-handle-label">Heroes</span>
        <span className="shop-toggle-hotkey">Space</span>
      </button>

      <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  );
}
