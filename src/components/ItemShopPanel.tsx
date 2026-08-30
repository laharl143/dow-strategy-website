import { useMemo, useState } from 'react';
import type { RegularItem, NeutralItem } from '../types';
import { RegularItemColumns, NeutralItemTray } from './ItemTray';

type ShopTab = 'basics' | 'upgrades' | 'neutrals';

const TABS: { value: ShopTab; label: string }[] = [
  { value: 'basics', label: 'Basics' },
  { value: 'upgrades', label: 'Upgrades' },
  { value: 'neutrals', label: 'Neutrals' },
];

export function ItemShopPanel({
  regularItems,
  neutralsByTier,
  neutralsRemaining,
  bonusNeutralTier,
  onSetBonusNeutralTier,
}: {
  regularItems: RegularItem[];
  neutralsByTier: Map<number, NeutralItem[]>;
  /** Null when there's no active game board to count against (e.g. the Heroes reference pages). */
  neutralsRemaining: number | null;
  /** This game's random level-25 bonus tier — undefined on pages with no active board. */
  bonusNeutralTier?: 4 | 5;
  onSetBonusNeutralTier?: (tier: 4 | 5) => void;
}) {
  const [tab, setTab] = useState<ShopTab>('basics');
  const [query, setQuery] = useState('');

  const filteredRegular = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bucket = regularItems.filter((i) => i.shopTab === (tab === 'basics' ? 'basics' : 'upgrades'));
    if (!q) return bucket;
    return bucket.filter((i) => i.name.toLowerCase().includes(q));
  }, [regularItems, tab, query]);

  return (
    <div className="item-shop-panel">
      <div className="item-shop-search">
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="item-shop-tabs">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className="item-shop-tab"
            data-active={tab === t.value || undefined}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="item-shop-body">
        {tab === 'neutrals' ? (
          <NeutralItemTray
            itemsByTier={neutralsByTier}
            remaining={neutralsRemaining}
            bonusNeutralTier={bonusNeutralTier}
            onSetBonusNeutralTier={onSetBonusNeutralTier}
          />
        ) : (
          <RegularItemColumns items={filteredRegular} shopTab={tab} />
        )}
      </div>
    </div>
  );
}
