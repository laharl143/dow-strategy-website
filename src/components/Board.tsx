import type { Board as BoardType, Hero, NeutralItem, Item } from '../types';
import { ROLE_SLOTS } from '../data/roleSlots';
import { RoleSlotCard } from './RoleSlotCard';
import { useHeroContextMenu } from './HeroContextMenu';

export function Board({
  board,
  heroes,
  assignedHeroSlugs,
  heroBySlug,
  regularItemBySlug,
  neutralItemBySlug,
  onRemoveHero,
  onPickHero,
  onRemoveRegularItem,
  onRemoveNeutralItem,
  onToggleScepter,
  onToggleShard,
}: {
  board: BoardType;
  heroes: Hero[];
  assignedHeroSlugs: Set<string>;
  heroBySlug: Map<string, Hero>;
  regularItemBySlug: Map<string, Item>;
  neutralItemBySlug: Map<string, NeutralItem>;
  onRemoveHero: (slotId: string) => void;
  onPickHero: (slotId: string, heroSlug: string) => void;
  onRemoveRegularItem: (slotId: string, index: number) => void;
  onRemoveNeutralItem: (slotId: string) => void;
  onToggleScepter: (slotId: string) => void;
  onToggleShard: (slotId: string) => void;
}) {
  const { openMenu, menuNode } = useHeroContextMenu();

  return (
    <div className="board">
      {ROLE_SLOTS.map((definition) => {
        const slot = board.slots.find((s) => s.slotId === definition.id)!;
        return (
          <RoleSlotCard
            key={definition.id}
            definition={definition}
            slot={slot}
            hero={slot.heroSlug ? heroBySlug.get(slot.heroSlug) : undefined}
            regularItems={slot.regularItemSlugs.map((s) => (s ? regularItemBySlug.get(s) : undefined))}
            neutralItem={slot.neutralItemSlug ? neutralItemBySlug.get(slot.neutralItemSlug) : undefined}
            heroes={heroes}
            assignedHeroSlugs={assignedHeroSlugs}
            onRemoveHero={() => onRemoveHero(definition.id)}
            onPickHero={(heroSlug) => onPickHero(definition.id, heroSlug)}
            onRemoveRegularItem={(i) => onRemoveRegularItem(definition.id, i)}
            onRemoveNeutralItem={() => onRemoveNeutralItem(definition.id)}
            onToggleScepter={() => onToggleScepter(definition.id)}
            onToggleShard={() => onToggleShard(definition.id)}
            onHeroContextMenu={openMenu}
          />
        );
      })}
      {menuNode}
    </div>
  );
}
