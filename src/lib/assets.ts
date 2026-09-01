// Hotlinked from Valve's own CDN (see docs/adr/0001-static-spa-no-backend.md and
// the grill-session decision to hotlink rather than host copies for this personal-use tool).
// Filenames match each hero's Dota 2 internal name 1:1, which is also our `Hero.code`.
const HERO_ICON_BASE = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes';

export function heroIconUrl(code: string): string {
  return `${HERO_ICON_BASE}/${code}.png`;
}

const ITEM_ICON_BASE = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/items';

export function itemIconUrl(code: string): string {
  return `${ITEM_ICON_BASE}/${code}.png`;
}

const ABILITY_ICON_BASE = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/abilities';

export function abilityIconUrl(slug: string): string {
  return `${ABILITY_ICON_BASE}/${slug}.png`;
}

// Aghanim's Scepter/Shard: a per-hero binary upgrade flag, not part of the
// regular/neutral item catalog. Icons use Dota 2's own internal item names.
export const SCEPTER_ICON_URL = itemIconUrl('ultimate_scepter');
export const SHARD_ICON_URL = itemIconUrl('aghanims_shard');
