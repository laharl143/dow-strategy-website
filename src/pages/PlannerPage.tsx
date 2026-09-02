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
  checkAssignNeutral,
  countAssignedNeutrals,
  setHero,
  setNeutralItem,
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
  type NeutralAssignError,
} from '../lib/boardRules';
import { NEUTRAL_ITEM_CAP } from '../lib/boardRules';
import { placeHeroAt, type HeroTarget } from '../lib/heroPlacement';
import { loadShopOpen, saveShopOpen } from '../lib/persistence';
import { Board } from '../components/Board';
import { HeroTray } from '../components/HeroTray';
import { ItemShopPanel } from '../components/ItemShopPanel';
import { StrategyList } from '../components/StrategyList';

function neutralErrorMessage(error: NeutralAssignError, tier: number, bonusTier: number): string | null {
  if (!error) return null;
  if (error === 'total-cap') return 'Neutral item cap reached (6) — remove one first.';
  return tier === bonusTier
    ? `Only two Tier ${tier} items are possible this game (1 guaranteed + 1 level-25 bonus).`
    : `Not possible to have two Tier ${tier} items — this game's level-25 bonus went to Tier ${bonusTier}.`;
}

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
  const [twoColumns, setTwoColumns] = useState(false);
  const [neutralError, setNeutralError] = useState<string | null>(null);

  useEffect(() => {
    saveShopOpen(shopOpen);
  }, [shopOpen]);

  useEffect(() => {
    if (!neutralError) return;
    const timer = setTimeout(() => setNeutralError(null), 3500);
    return () => clearTimeout(timer);
  }, [neutralError]);
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

    // Written to (at most once) by the neutral-item branches below when a
    // placement is rejected — read after setBoard() returns since the
    // updater itself must stay pure (React 18 Strict Mode double-invokes it).
    let rejection: string | null = null;

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
        const error = checkAssignNeutral(prev, overData.slotId, activeData.itemSlug, neutralItemBySlug);
        if (error) {
          rejection = neutralErrorMessage(error, neutralItemBySlug.get(activeData.itemSlug)?.tier ?? 0, prev.bonusNeutralTier);
          return prev;
        }
        return setNeutralItem(prev, overData.slotId, activeData.itemSlug, neutralItemBySlug);
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
        const withoutOld = setNeutralItem(prev, activeData.fromSlotId, null, neutralItemBySlug);
        const error = checkAssignNeutral(withoutOld, overData.slotId, activeData.itemSlug, neutralItemBySlug);
        if (error) {
          rejection = neutralErrorMessage(error, neutralItemBySlug.get(activeData.itemSlug)?.tier ?? 0, prev.bonusNeutralTier);
          return prev;
        }
        return setNeutralItem(withoutOld, overData.slotId, activeData.itemSlug, neutralItemBySlug);
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

    if (rejection) setNeutralError(rejection);
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

  function handlePickNeutralItem(slotId: string, itemSlug: string) {
    const error = checkAssignNeutral(board, slotId, itemSlug, neutralItemBySlug);
    if (error) {
      setNeutralError(neutralErrorMessage(error, neutralItemBySlug.get(itemSlug)?.tier ?? 0, board.bonusNeutralTier));
      return;
    }
    setBoard((prev) => setNeutralItem(prev, slotId, itemSlug, neutralItemBySlug));
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
            onRemoveNeutralItem={(slotId) => setBoard((prev) => setNeutralItem(prev, slotId, null, neutralItemBySlug))}
            onPickNeutralItem={handlePickNeutralItem}
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
            onApplyBuild={(slotId, build) => setBoard((prev) => applyHeroBuild(prev, slotId, build, neutralItemBySlug))}
            onApplyLateGameBuild={(slotId, build) => setBoard((prev) => applyLateGameHeroBuild(prev, slotId, build))}
          />
        </main>

        <aside className="right-panel">
          <ItemShopPanel
            regularItems={regularItems}
            neutralsByTier={neutralsByTier}
            neutralsRemaining={neutralsRemaining}
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

      {neutralError && <div className="neutral-error-toast">{neutralError}</div>}

      <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  );
}
