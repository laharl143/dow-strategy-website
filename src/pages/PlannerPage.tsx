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
  setHero,
  setNeutralItem,
  neutralTierDuplicateGroups,
  setBonusNeutralTier,
  setRegularItem,
  toggleScepter,
  toggleShard,
  addLateGameSwap,
  removeLateGameSwap,
  clearLateGameHero,
  setLateGameRegularItem,
  setLateGameNeutralItem,
  toggleLateGameScepter,
  toggleLateGameShard,
  applyHeroBuild,
  applyLateGameHeroBuild,
  toggleRegularItemAutocast,
  toggleNeutralItemAutocast,
  toggleLateGameRegularItemAutocast,
  toggleLateGameNeutralItemAutocast,
} from '../lib/boardRules';
import { placeHeroAt, type HeroTarget } from '../lib/heroPlacement';
import { loadShopOpen, saveShopOpen, loadTwoColumns, saveTwoColumns } from '../lib/persistence';
import { Board } from '../components/Board';
import { DuplicateTierNotices } from '../components/DuplicateTierNotices';
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
  const [shopOpen, setShopOpen] = useState(loadShopOpen);
  const [heroPanelOpen, setHeroPanelOpen] = useState(true);
  const [twoColumns, setTwoColumns] = useState(loadTwoColumns);

  useEffect(() => {
    saveShopOpen(shopOpen);
  }, [shopOpen]);

  useEffect(() => {
    saveTwoColumns(twoColumns);
  }, [twoColumns]);

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

  const assignedHeroSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const s of board.slots) {
      if (s.heroSlug) slugs.add(s.heroSlug);
      if (s.lateGameSwap?.heroSlug) slugs.add(s.lateGameSwap.heroSlug);
    }
    return slugs;
  }, [board]);

  const neutralsByTier = useMemo(() => {
    const map = new Map<number, NeutralItem[]>();
    for (const item of neutralItems) {
      const list = map.get(item.tier) ?? [];
      list.push(item);
      map.set(item.tier, list);
    }
    return map;
  }, []);

  const duplicateTierGroups = useMemo(
    () => neutralTierDuplicateGroups(board, neutralItemBySlug),
    [board, neutralItemBySlug],
  );

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
      // Placing/moving/swapping a hero into a primary or late-game-swap
      // hero spot — from the tray, from another role's primary spot, or
      // from another role's late-game spot. placeHeroAt finds wherever the
      // dragged hero currently lives (if anywhere) and swaps it in.
      if (
        (activeData.kind === 'hero' || activeData.kind === 'hero-slot' || activeData.kind === 'lategame-hero-slot') &&
        (overData.kind === 'hero-slot' || overData.kind === 'lategame-hero-slot') &&
        overData.slotId &&
        activeData.heroSlug
      ) {
        const target: HeroTarget =
          overData.kind === 'hero-slot' ? { kind: 'primary', slotId: overData.slotId } : { kind: 'lategame', slotId: overData.slotId };
        return placeHeroAt(prev, target, activeData.heroSlug);
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
        return setNeutralItem(prev, overData.slotId, activeData.itemSlug);
      }

      // Moving a regular item already on the board to another regular slot —
      // swaps with whatever's already there instead of discarding it.
      if (
        activeData.kind === 'regular-item-slot' &&
        overData.kind === 'regular-item-slot' &&
        activeData.fromSlotId &&
        activeData.fromItemIndex !== undefined &&
        overData.slotId &&
        overData.itemIndex !== undefined
      ) {
        const displaced =
          prev.slots.find((s) => s.slotId === overData.slotId)?.regularItemSlugs[overData.itemIndex!] ?? null;
        const withDisplaced = setRegularItem(prev, activeData.fromSlotId, activeData.fromItemIndex, displaced);
        return setRegularItem(withDisplaced, overData.slotId, overData.itemIndex, activeData.itemSlug ?? null);
      }

      // Moving a neutral item already on the board to another hero's neutral slot.
      if (
        activeData.kind === 'neutral-item-slot' &&
        overData.kind === 'neutral-item-slot' &&
        activeData.fromSlotId &&
        overData.slotId
      ) {
        if (!activeData.itemSlug) return prev;
        const withoutOld = setNeutralItem(prev, activeData.fromSlotId, null);
        return setNeutralItem(withoutOld, overData.slotId, activeData.itemSlug);
      }

      // Placing a regular item from the tray into a late-game swap slot.
      if (
        activeData.kind === 'regular-item' &&
        overData.kind === 'lategame-regular-item-slot' &&
        overData.slotId &&
        overData.itemIndex !== undefined
      ) {
        return setLateGameRegularItem(prev, overData.slotId, overData.itemIndex, activeData.itemSlug ?? null);
      }

      // Placing a neutral item from the tray into a late-game swap slot (not
      // counted against the board's neutral cap — see setLateGameNeutralItem).
      if (activeData.kind === 'neutral-item' && overData.kind === 'lategame-neutral-item-slot' && overData.slotId) {
        if (!activeData.itemSlug) return prev;
        return setLateGameNeutralItem(prev, overData.slotId, activeData.itemSlug);
      }

      // Moving a late-game regular item to another late-game regular slot —
      // swaps with whatever's already there instead of discarding it.
      if (
        activeData.kind === 'lategame-regular-item-slot' &&
        overData.kind === 'lategame-regular-item-slot' &&
        activeData.fromSlotId &&
        activeData.fromItemIndex !== undefined &&
        overData.slotId &&
        overData.itemIndex !== undefined
      ) {
        const displaced =
          prev.slots.find((s) => s.slotId === overData.slotId)?.lateGameSwap?.regularItemSlugs[overData.itemIndex!] ??
          null;
        const withDisplaced = setLateGameRegularItem(prev, activeData.fromSlotId, activeData.fromItemIndex, displaced);
        return setLateGameRegularItem(withDisplaced, overData.slotId, overData.itemIndex, activeData.itemSlug ?? null);
      }

      // Moving a late-game neutral item to another late-game neutral slot.
      if (
        activeData.kind === 'lategame-neutral-item-slot' &&
        overData.kind === 'lategame-neutral-item-slot' &&
        activeData.fromSlotId &&
        overData.slotId
      ) {
        const withoutOld = setLateGameNeutralItem(prev, activeData.fromSlotId, null);
        return setLateGameNeutralItem(withoutOld, overData.slotId, activeData.itemSlug ?? null);
      }

      return prev;
    });
  }

  function renderDragOverlay() {
    if (!activeDrag) return null;

    if (
      (activeDrag.kind === 'hero' || activeDrag.kind === 'hero-slot' || activeDrag.kind === 'lategame-hero-slot') &&
      activeDrag.heroSlug
    ) {
      const hero = heroBySlug.get(activeDrag.heroSlug);
      if (!hero) return null;
      return <img className="drag-overlay-hero-icon" src={heroIconUrl(hero.code)} alt={hero.name} />;
    }

    if (
      (activeDrag.kind === 'regular-item' ||
        activeDrag.kind === 'regular-item-slot' ||
        activeDrag.kind === 'lategame-regular-item-slot') &&
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
      (activeDrag.kind === 'neutral-item' ||
        activeDrag.kind === 'neutral-item-slot' ||
        activeDrag.kind === 'lategame-neutral-item-slot') &&
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
          <button
            type="button"
            className="board-columns-toggle"
            data-active={twoColumns || undefined}
            onClick={() => setTwoColumns((v) => !v)}
            title={twoColumns ? 'Show roles 1-9 in a single column' : 'Split roles 6-9 into a second column'}
          >
            {twoColumns ? '▥ Two Columns' : '▤ One Column'}
          </button>
          <Board
            board={board}
            twoColumns={twoColumns}
            heroes={heroes}
            assignedHeroSlugs={assignedHeroSlugs}
            heroBySlug={heroBySlug}
            regularItems={regularItems}
            regularItemBySlug={regularItemBySlug}
            neutralItems={neutralItems}
            neutralItemBySlug={neutralItemBySlug}
            onRemoveHero={(slotId) => setBoard((prev) => setHero(prev, slotId, null))}
            onPickHero={(slotId, heroSlug) => setBoard((prev) => placeHeroAt(prev, { kind: 'primary', slotId }, heroSlug))}
            onRemoveRegularItem={(slotId, i) => setBoard((prev) => setRegularItem(prev, slotId, i, null))}
            onPickRegularItem={(slotId, i, itemSlug) => setBoard((prev) => setRegularItem(prev, slotId, i, itemSlug))}
            onRemoveNeutralItem={(slotId) => setBoard((prev) => setNeutralItem(prev, slotId, null))}
            onPickNeutralItem={(slotId, itemSlug) => setBoard((prev) => setNeutralItem(prev, slotId, itemSlug))}
            neutralTierDuplicateGroups={duplicateTierGroups}
            onToggleScepter={(slotId) => setBoard((prev) => toggleScepter(prev, slotId))}
            onToggleShard={(slotId) => setBoard((prev) => toggleShard(prev, slotId))}
            onAddLateGameSwap={(slotId) => setBoard((prev) => addLateGameSwap(prev, slotId))}
            onRemoveLateGameSwap={(slotId) => setBoard((prev) => removeLateGameSwap(prev, slotId))}
            onRemoveLateGameHero={(slotId) => setBoard((prev) => clearLateGameHero(prev, slotId))}
            onPickLateGameHero={(slotId, heroSlug) => setBoard((prev) => placeHeroAt(prev, { kind: 'lategame', slotId }, heroSlug))}
            onRemoveLateGameRegularItem={(slotId, i) => setBoard((prev) => setLateGameRegularItem(prev, slotId, i, null))}
            onPickLateGameRegularItem={(slotId, i, itemSlug) =>
              setBoard((prev) => setLateGameRegularItem(prev, slotId, i, itemSlug))
            }
            onRemoveLateGameNeutralItem={(slotId) => setBoard((prev) => setLateGameNeutralItem(prev, slotId, null))}
            onPickLateGameNeutralItem={(slotId, itemSlug) => setBoard((prev) => setLateGameNeutralItem(prev, slotId, itemSlug))}
            onToggleLateGameScepter={(slotId) => setBoard((prev) => toggleLateGameScepter(prev, slotId))}
            onToggleLateGameShard={(slotId) => setBoard((prev) => toggleLateGameShard(prev, slotId))}
            onApplyBuild={(slotId, build) => setBoard((prev) => applyHeroBuild(prev, slotId, build))}
            onApplyLateGameBuild={(slotId, build) => setBoard((prev) => applyLateGameHeroBuild(prev, slotId, build))}
            onToggleRegularAutocast={(slotId, i) => setBoard((prev) => toggleRegularItemAutocast(prev, slotId, i))}
            onToggleNeutralAutocast={(slotId) => setBoard((prev) => toggleNeutralItemAutocast(prev, slotId))}
            onToggleLateGameRegularAutocast={(slotId, i) =>
              setBoard((prev) => toggleLateGameRegularItemAutocast(prev, slotId, i))
            }
            onToggleLateGameNeutralAutocast={(slotId) =>
              setBoard((prev) => toggleLateGameNeutralItemAutocast(prev, slotId))
            }
          />
        </main>

        <aside className="right-panel">
          <ItemShopPanel
            regularItems={regularItems}
            neutralsByTier={neutralsByTier}
            neutralsRemaining={null}
            bonusNeutralTier={board.bonusNeutralTier}
            onSetBonusNeutralTier={(tier) => setBoard((prev) => setBonusNeutralTier(prev, tier))}
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

      <DuplicateTierNotices groups={duplicateTierGroups} heroBySlug={heroBySlug} shopOpen={shopOpen} />

      <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  );
}
