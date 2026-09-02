import { useMemo, useState } from 'react';
import type { Hero } from '../types';

/**
 * Corner notice stack (DOW-23 follow-up) — names which heroes are competing
 * for the same neutral tier, since the board's glow alone says "duplicate"
 * but not "duplicate of what." One dismissible card per duplicated tier;
 * a card comes back if its own hero lineup changes after being dismissed
 * (a different duplicate, even at the same tier, is worth resurfacing).
 */
export function DuplicateTierNotices({
  groups,
  heroBySlug,
}: {
  /** Tier -> hero slugs sharing it, tiers with fewer than 2 already excluded. */
  groups: Map<number, string[]>;
  heroBySlug: Map<string, Hero>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const cards = useMemo(() => {
    return [...groups.entries()]
      .map(([tier, heroSlugs]) => {
        const names = heroSlugs.map((slug) => heroBySlug.get(slug)?.name ?? slug).sort((a, b) => a.localeCompare(b));
        const key = `${tier}:${[...heroSlugs].sort().join(',')}`;
        return { tier, names, key };
      })
      .sort((a, b) => a.tier - b.tier);
  }, [groups, heroBySlug]);

  const visible = cards.filter((c) => !dismissed.has(c.key));
  if (visible.length === 0) return null;

  return (
    <div className="duplicate-tier-stack">
      {visible.map((card) => (
        <div key={card.key} className="duplicate-tier-card" data-tier={card.tier}>
          <span className="duplicate-tier-dot" />
          <span className="duplicate-tier-text">
            Tier {card.tier}: <strong>{card.names.join(', ')}</strong>
          </span>
          <button
            type="button"
            className="duplicate-tier-dismiss"
            title="Dismiss"
            onClick={() => setDismissed((prev) => new Set(prev).add(card.key))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
