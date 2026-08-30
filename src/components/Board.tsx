import type { Board as BoardType, Hero, NeutralItem, Item } from '../types';
import { ROLE_SLOTS } from '../data/roleSlots';
import { RoleSlotCard } from './RoleSlotCard';
import { LateGameSwapCard } from './LateGameSwapCard';
import { useHeroContextMenu } from './HeroContextMenu';

export function Board({
  board,
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
}: {
  board: BoardType;
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
}) {
  const { openMenu, menuNode } = useHeroContextMenu();

  return (
    <div className="board">
      {ROLE_SLOTS.map((definition) => {
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
      })}
      {menuNode}
    </div>
  );
}
