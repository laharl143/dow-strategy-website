import type { Hero } from '../types';
import { loadHeroCombos } from '../lib/persistence';
import { heroBySlug } from '../lib/gameData';
import { heroIconUrl } from '../lib/assets';

/**
 * Read-only board-side indicator for DOW-10's special combos — one small
 * icon crop per one of the 7 special heroes flagged as able to target this
 * hero (set on the hero's own page; the board never edits it). Any hero can
 * have these, not just the 7 special ones themselves. Renders nothing for a
 * hero with no giver checked yet.
 */
export function ComboDots({ hero }: { hero: Hero }) {
  const givers = loadHeroCombos()[hero.slug] ?? [];
  if (givers.length === 0) return null;

  return (
    <span className="combo-dots" title={`Targetable by ${givers.length} special combo${givers.length > 1 ? 's' : ''}`}>
      {givers.map((slug) => {
        const giver = heroBySlug.get(slug);
        if (!giver) return null;
        return <img key={slug} className="combo-dot" src={heroIconUrl(giver.code)} alt={giver.name} title={giver.name} />;
      })}
    </span>
  );
}
