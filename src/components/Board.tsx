import type { Board as BoardType, Hero, NeutralItem, Item, RoleSlotDefinition } from '../types';
import type { HeroBuild } from '../lib/persistence';
import { ROLE_SLOTS } from '../data/roleSlots';
import { RoleSlotCard } from './RoleSlotCard';
import { LateGameSwapCard } from './LateGameSwapCard';
import { useHeroContextMenu } from './HeroContextMenu';

// When split into two columns, the first column keeps roles 1-5 and the
// second takes 6-9 — matching how the board reads top-to-bottom today, just
// broken at the midpoint instead of requiring a long scroll.
const COLUMN_SPLIT = 5;

export function Board({
  board,
  twoColumns,
  heroes,
  assignedHeroSlugs,
  heroBySlug,
  regularItems,
  regularItemBySlug,
  neutralItems,
  neutralItemBySlug,
  onRemoveHero,
  onPickHero,
  onRemoveRegularItem,
  onPickRegularItem,
  onRemoveNeutralItem,
  onPickNeutralItem,
  onToggleScepter,
  onToggleShard,
  onAddLateGameSwap,
  onRemoveLateGameSwap,
  onRemoveLateGameHero,
  onPickLateGameHero,
  onRemoveLateGameRegularItem,
  onPickLateGameRegularItem,
  onRemoveLateGameNeutralItem,
  onPickLateGameNeutralItem,
  onToggleLateGameScepter,
  onToggleLateGameShard,
  onApplyBuild,
  onApplyLateGameBuild,
}: {
  board: BoardType;
  twoColumns: boolean;
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  heroBySlug: Map<string, Hero>;
  regularItems: Item[];
  regularItemBySlug: Map<string, Item>;
  neutralItems: NeutralItem[];
  neutralItemBySlug: Map<string, NeutralItem>;
  onRemoveHero: (slotId: string) => void;
  onPickHero: (slotId: string, heroSlug: string) => void;
  onRemoveRegularItem: (slotId: string, index: number) => void;
  onPickRegularItem: (slotId: string, index: number, itemSlug: string) => void;
  onRemoveNeutralItem: (slotId: string) => void;
  onPickNeutralItem: (slotId: string, itemSlug: string) => void;
  onToggleScepter: (slotId: string) => void;
  onToggleShard: (slotId: string) => void;
  onAddLateGameSwap: (slotId: string) => void;
  onRemoveLateGameSwap: (slotId: string) => void;
  onRemoveLateGameHero: (slotId: string) => void;
  onPickLateGameHero: (slotId: string, heroSlug: string) => void;
  onRemoveLateGameRegularItem: (slotId: string, index: number) => void;
  onPickLateGameRegularItem: (slotId: string, index: number, itemSlug: string) => void;
  onRemoveLateGameNeutralItem: (slotId: string) => void;
  onPickLateGameNeutralItem: (slotId: string, itemSlug: string) => void;
  onToggleLateGameScepter: (slotId: string) => void;
  onToggleLateGameShard: (slotId: string) => void;
  onApplyBuild: (slotId: string, build: HeroBuild) => void;
  onApplyLateGameBuild: (slotId: string, build: HeroBuild) => void;
}) {
  const { openMenu, menuNode } = useHeroContextMenu();

  function renderRow(definition: RoleSlotDefinition) {
    const slot = board.slots.find((s) => s.slotId === definition.id)!;
    const swap = slot.lateGameSwap;
    return (
      <div className="role-slot-row" key={definition.id}>
        <RoleSlotCard
          definition={definition}
          slot={slot}
          hero={slot.heroSlug ? heroBySlug.get(slot.heroSlug) : undefined}
          regularItems={slot.regularItemSlugs.map((s) => (s ? regularItemBySlug.get(s) : undefined))}
          regularItemsCatalog={regularItems}
          neutralItem={slot.neutralItemSlug ? neutralItemBySlug.get(slot.neutralItemSlug) : undefined}
          neutralItemsCatalog={neutralItems}
          heroes={heroes}
          assignedHeroSlugs={assignedHeroSlugs}
          onRemoveHero={() => onRemoveHero(definition.id)}
          onPickHero={(heroSlug) => onPickHero(definition.id, heroSlug)}
          onRemoveRegularItem={(i) => onRemoveRegularItem(definition.id, i)}
          onPickRegularItem={(i, itemSlug) => onPickRegularItem(definition.id, i, itemSlug)}
          onRemoveNeutralItem={() => onRemoveNeutralItem(definition.id)}
          onPickNeutralItem={(itemSlug) => onPickNeutralItem(definition.id, itemSlug)}
          onToggleScepter={() => onToggleScepter(definition.id)}
          onToggleShard={() => onToggleShard(definition.id)}
          onHeroContextMenu={openMenu}
          onApplyBuild={(build) => onApplyBuild(definition.id, build)}
        />

        {swap && (
          <div className="role-slot-connector" title="This card is a late-game swap for the role on the left">
            <span className="role-slot-connector-line" />
            <span className="role-slot-connector-pill">Swap</span>
          </div>
        )}

        {swap ? (
          <LateGameSwapCard
            slotId={definition.id}
            swap={swap}
            hero={swap.heroSlug ? heroBySlug.get(swap.heroSlug) : undefined}
            regularItems={swap.regularItemSlugs.map((s) => (s ? regularItemBySlug.get(s) : undefined))}
            regularItemsCatalog={regularItems}
            neutralItem={swap.neutralItemSlug ? neutralItemBySlug.get(swap.neutralItemSlug) : undefined}
            neutralItemsCatalog={neutralItems}
            heroes={heroes}
            assignedHeroSlugs={assignedHeroSlugs}
            onRemove={() => onRemoveLateGameSwap(definition.id)}
            onRemoveHero={() => onRemoveLateGameHero(definition.id)}
            onPickHero={(heroSlug) => onPickLateGameHero(definition.id, heroSlug)}
            onRemoveRegularItem={(i) => onRemoveLateGameRegularItem(definition.id, i)}
            onPickRegularItem={(i, itemSlug) => onPickLateGameRegularItem(definition.id, i, itemSlug)}
            onRemoveNeutralItem={() => onRemoveLateGameNeutralItem(definition.id)}
            onPickNeutralItem={(itemSlug) => onPickLateGameNeutralItem(definition.id, itemSlug)}
            onToggleScepter={() => onToggleLateGameScepter(definition.id)}
            onToggleShard={() => onToggleLateGameShard(definition.id)}
            onHeroContextMenu={openMenu}
            onApplyBuild={(build) => onApplyLateGameBuild(definition.id, build)}
          />
        ) : (
          <button
            type="button"
            className="role-slot-late-add"
            title="Add a late-game hero swap"
            onClick={() => onAddLateGameSwap(definition.id)}
          >
            +
          </button>
        )}
      </div>
    );
  }

  if (twoColumns) {
    const first = ROLE_SLOTS.slice(0, COLUMN_SPLIT);
    const second = ROLE_SLOTS.slice(COLUMN_SPLIT);
    return (
      <div className="board board-columns">
        <div className="board-column">{first.map(renderRow)}</div>
        <div className="board-column">{second.map(renderRow)}</div>
        {menuNode}
      </div>
    );
  }

  return (
    <div className="board">
      {ROLE_SLOTS.map(renderRow)}
      {menuNode}
    </div>
  );
}
