import type { Board as BoardType, Hero, NeutralItem, Item } from '../types';
import { ROLE_SLOTS } from '../data/roleSlots';
import { RoleSlotCard } from './RoleSlotCard';
import { useHeroContextMenu } from './HeroContextMenu';

export function Board({
  board,
  heroBySlug,
  regularItemBySlug,
  neutralItemBySlug,
  onRemoveHero,
  onRemoveRegularItem,
  onRemoveNeutralItem,
  onToggleScepter,
  onToggleShard,
}: {
  board: BoardType;
  heroBySlug: Map<string, Hero>;
  regularItemBySlug: Map<string, Item>;
  neutralItemBySlug: Map<string, NeutralItem>;
  onRemoveHero: (slotId: string) => void;
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
            onRemoveHero={() => onRemoveHero(definition.id)}
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
