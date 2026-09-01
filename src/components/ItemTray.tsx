import { useDraggable } from '@dnd-kit/core';
import type { Item, NeutralItem, RegularItem, ShopCategory } from '../types';

function DraggableItem({
  item,
  dragId,
  dragData,
  large,
}: {
  item: Item;
  dragId: string;
  dragData: Record<string, unknown>;
  large?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: dragData });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="item-chip"
      data-dragging={isDragging || undefined}
      data-large={large || undefined}
      title={item.name}
    >
      {item.iconUrl ? (
        <img className="item-chip-icon" src={item.iconUrl} alt={item.name} draggable={false} />
      ) : (
        item.name
      )}
    </div>
  );
}

const BASICS_CATEGORY_ORDER: ShopCategory[] = ['consumables', 'attributes', 'weapons_armor', 'misc', 'secretshop'];
const UPGRADES_CATEGORY_ORDER: ShopCategory[] = ['basics', 'support', 'magics', 'defense', 'weapons', 'artifacts'];

const CATEGORY_LABELS: Record<ShopCategory, string> = {
  consumables: 'Consumables',
  attributes: 'Attributes',
  weapons_armor: 'Weapons/Armor',
  misc: 'Misc',
  secretshop: 'Secret Shop',
  basics: 'Basics',
  support: 'Support',
  magics: 'Magics',
  defense: 'Defense',
  weapons: 'Weapons',
  artifacts: 'Artifacts',
};

export function RegularItemColumns({ items, shopTab }: { items: RegularItem[]; shopTab: 'basics' | 'upgrades' }) {
  if (items.length === 0) {
    return <p className="empty-tray">No items in this tab yet.</p>;
  }
  const single = items.length === 1;
  const categoryOrder = shopTab === 'basics' ? BASICS_CATEGORY_ORDER : UPGRADES_CATEGORY_ORDER;
  return (
    <div className="shop-category-columns" data-single={single || undefined}>
      {categoryOrder.map((category) => {
        const list = items.filter((item) => item.category === category).sort((a, b) => a.order - b.order);
        if (list.length === 0) return null;
        return (
          <div key={category} className="shop-category-column" title={CATEGORY_LABELS[category]}>
            {list.map((item) => (
              <DraggableItem
                key={item.slug}
                item={item}
                dragId={`regular-tray:${item.slug}`}
                dragData={{ kind: 'regular-item', itemSlug: item.slug }}
                large={single}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function NeutralItemTray({
  itemsByTier,
  remaining,
  bonusNeutralTier,
  onSetBonusNeutralTier,
}: {
  itemsByTier: Map<number, NeutralItem[]>;
  remaining: number | null;
  bonusNeutralTier?: 4 | 5;
  onSetBonusNeutralTier?: (tier: 4 | 5) => void;
}) {
  const hasAny = [...itemsByTier.values()].some((list) => list.length > 0);
  return (
    <div className="item-tray neutral-tray">
      {bonusNeutralTier !== undefined && onSetBonusNeutralTier && (
        <div className="bonus-tier-toggle">
          <button
            type="button"
            className="bonus-tier-switch"
            data-tier={bonusNeutralTier}
            title={`This game's bonus: Tier ${bonusNeutralTier} — click to switch to Tier ${bonusNeutralTier === 4 ? 5 : 4}`}
            onClick={() => onSetBonusNeutralTier(bonusNeutralTier === 4 ? 5 : 4)}
          >
            <span className="bonus-tier-switch-thumb" />
            <span className="bonus-tier-switch-option">Tier 4</span>
            <span className="bonus-tier-switch-option">Tier 5</span>
          </button>
        </div>
      )}
      {remaining !== null && (
        <div className="neutral-tray-header">
          Neutral items remaining this game: <strong>{remaining}</strong> / 6
        </div>
      )}
      {!hasAny && (
        <div className="empty-tray">
          No neutral items catalogued yet — add them to{' '}
          <code>src/data/neutralItems.json</code> once you have the tier/name list.
        </div>
      )}
      {hasAny && (
        <div className="neutral-tier-columns">
          {[1, 2, 3, 4, 5].map((tier) => {
            const list = itemsByTier.get(tier) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={tier} className="neutral-tier-column">
                <span className="neutral-tier-label">T{tier}</span>
                {list.map((item) => (
                  <DraggableItem
                    key={item.slug}
                    item={item}
                    dragId={`neutral-tray:${item.slug}`}
                    dragData={{ kind: 'neutral-item', itemSlug: item.slug }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
