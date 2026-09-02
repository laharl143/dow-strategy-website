export type CompositionRole = 'tank' | 'core' | 'support';
export type PickFrequency = 'always' | 'sometimes' | 'never';
export type DamageType = 'physical' | 'magic';
export type PowerCurve = 'early' | 'mid' | 'late' | 'flex';
export type AttackType = 'melee' | 'ranged';
export type ItemCategory = 'artifact' | 'enchantment';

export interface Ability {
  /** Dota 2 internal ability name, used to build the CDN icon URL. */
  slug: string;
  name: string;
  desc: string;
  ultimate: boolean;
}

export interface Hero {
  slug: string;
  name: string;
  /** Dota 2 internal hero name, usable with the mod's `-addhero` cheat command. */
  code: string;
  primaryAttribute: string | null;
  attackType: AttackType | null;
  /** Valve's own listed Dota 2 roles — informational only, not DoW-specific. */
  dotaRoles: string[];
  /** Dawn-of-War-specific composition tagging. A hero can fill more than one role
   * (e.g. Anti-Mage as both Tank and Core). Empty until tagged. */
  compositionRoles: CompositionRole[];
  /** How often this hero is worth picking in the user's strategy. Null until tagged. */
  pickFrequency: PickFrequency | null;
  damageType: DamageType | null;
  powerCurve: PowerCurve | null;
  hasAoeStun: boolean;
  piercesMagicImmunity: boolean;
  /** True when this record wasn't found in the reference data source and needs a manual check. */
  needsReview: boolean;
  /** Recommended-build item slugs for this hero, shown on its dedicated page. */
  coreItemSlugs: string[];
  situationalItemSlugs: string[];
  /** Skillable Q/W/E/R abilities (innate and item abilities excluded), shown on the hero page. */
  abilities: Ability[];
}

export interface Item {
  slug: string;
  name: string;
  iconUrl: string | null;
}

/** Which of the mod's shop tabs an item belongs to (mirrors DOW's own Basics/Upgrades/Neutrals UI). */
export type ShopTab = 'basics' | 'upgrades';

/**
 * The mod's own shop sub-category, extracted directly from scripts/shops.txt.
 * Basics tab: consumables | attributes | weapons_armor | misc | secretshop.
 * Upgrades tab: basics | support | magics | defense | weapons | artifacts (the recipe tiers).
 * Used to lay out the shop panel as columns matching DOW's real in-game shop.
 */
export type ShopCategory =
  | 'consumables'
  | 'attributes'
  | 'weapons_armor'
  | 'misc'
  | 'secretshop'
  | 'basics'
  | 'support'
  | 'magics'
  | 'defense'
  | 'weapons'
  | 'artifacts';

export interface RegularItem extends Item {
  shopTab: ShopTab;
  category: ShopCategory;
  /** Position within its category column, taken directly from scripts/shops.txt order. */
  order: number;
}

export interface NeutralItem extends Item {
  /** DOW's own neutral tier, extracted directly from the mod's
   * scripts/npc/npc_neutral_items_custom.txt — not a Dota-standard guess. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** DOW's own Artifact/Enchantment split. Unknown until confirmed — omitted, not guessed. */
  category?: ItemCategory;
}

export interface RoleSlotDefinition {
  id: string;
  order: number;
  label: string;
  description: string;
  /** Broad composition category — colors the slot's role pill badge. */
  role: CompositionRole;
  /** Short pill badge text, e.g. "Core Magic" — distinguishes same-role slots. */
  tag: string;
}

/**
 * "I'll swap this hero out later" — an optional second hero+loadout for a
 * role slot, for heroes that are strong early but fall off, tracked
 * alongside (not instead of) the slot's primary hero. Present (non-null)
 * only once the user clicks the slot's "+" to add one.
 */
export interface LateGameSwap {
  heroSlug: string | null;
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  hasScepter: boolean;
  hasShard: boolean;
  /** Which of the hero's saved hero-page builds (if any) these items last came
   * from — lets the board show/switch which build a hero with several is
   * using here. Null once the items no longer came from picking a build (a
   * fresh hero with no saved build, or items edited by hand afterward). */
  appliedBuildId: string | null;
}

export interface BoardSlot {
  slotId: string;
  heroSlug: string | null;
  /** Fixed length 9: indices 0-5 are the active inventory, 6-8 are the backpack. */
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null; // 1 dedicated neutral slot
  /** Whether this game's hero has bought the Aghanim's Scepter/Shard upgrade. */
  hasScepter: boolean;
  hasShard: boolean;
  /** See {@link LateGameSwap.appliedBuildId} — same idea for the primary slot. */
  appliedBuildId: string | null;
  lateGameSwap: LateGameSwap | null;
}

export interface Board {
  slots: BoardSlot[];
  /**
   * At hero level 25 the team gets one bonus neutral item drop on top of
   * the guaranteed tier 1-5 — it's randomly a tier 4 or a tier 5, never
   * both. This records which one the RNG gave this game, so the board can
   * cap that tier at 2 instances (guaranteed + bonus) and every other tier
   * at 1.
   */
  bonusNeutralTier: 4 | 5;
}

export interface SavedStrategy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  board: Board;
}
