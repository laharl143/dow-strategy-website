import { useEffect, useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import type { Hero } from '../types';
import { COMBO_HERO_SLUGS } from '../data/comboHeroes';
import { heroBySlug } from '../lib/gameData';
import { heroIconUrl } from '../lib/assets';

/**
 * The "Special Combo" toggle, shown on every hero's page (DOW-10). The 7
 * COMBO_HERO_SLUGS each have a unique ability usable on any other hero
 * (Lycan bites a hero into a wolf, Snapfire cannonballs one across the map,
 * etc.) — so the flag here isn't "this hero has a combo," it's "which of
 * those 7 heroes' abilities work on *this* hero." Clicking the generic link
 * icon expands the 7 (minus this hero itself, if it's one of them) as
 * icon-only pips — click one to toggle it. Collapses back to the main icon
 * plus a small pip per giver that's checked once you click elsewhere.
 */
export function ComboToggle({
  hero,
  giverSlugs,
  onToggleGiver,
}: {
  hero: Hero;
  /** Which of the 7 special heroes can currently target this hero. */
  giverSlugs: string[];
  onToggleGiver: (giverSlug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function close() {
      setExpanded(false);
    }
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [expanded]);

  const givers = COMBO_HERO_SLUGS.filter((slug) => slug !== hero.slug)
    .map((slug) => heroBySlug.get(slug))
    .filter((h): h is Hero => !!h);

  const active = giverSlugs.length > 0;

  return (
    <div className="combo-toggle-row" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="combo-toggle-main"
        data-active={active || undefined}
        onClick={() => setExpanded((v) => !v)}
        title={active ? `Targetable by ${giverSlugs.length} special combo${giverSlugs.length > 1 ? 's' : ''} — click to edit` : 'No special combo set — click to edit'}
      >
        <FiUsers />
      </button>

      {expanded && <div className="combo-toggle-divider" />}

      {expanded
        ? givers.map((giver) => (
            <button
              key={giver.slug}
              type="button"
              className="combo-toggle-pip"
              data-checked={giverSlugs.includes(giver.slug) || undefined}
              title={giver.name}
              onClick={() => onToggleGiver(giver.slug)}
            >
              <img src={heroIconUrl(giver.code)} alt={giver.name} draggable={false} />
            </button>
          ))
        : giverSlugs.length > 0 && (
            <>
              <div className="combo-toggle-divider" />
              {giverSlugs.map((slug) => {
                const giver = heroBySlug.get(slug);
                if (!giver) return null;
                return (
                  <span key={slug} className="combo-toggle-small-pip" title={giver.name}>
                    <img src={heroIconUrl(giver.code)} alt={giver.name} draggable={false} />
                  </span>
                );
              })}
            </>
          )}
    </div>
  );
}
