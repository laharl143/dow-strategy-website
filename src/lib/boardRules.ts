import type { Board, LateGameSwap, NeutralItem } from '../types';
import type { HeroBuild } from './persistence';
import type { HeroTarget } from './heroPlacement';

// A hero's inventory: 6 active item slots + a 3-slot backpack, matching Dota 2's
// own layout. Index 0-5 = active, 6-8 = backpack.
export const ACTIVE_ITEM_SLOT_COUNT = 6;
export const BACKPACK_ITEM_SLOT_COUNT = 3;
export const REGULAR_ITEM_SLOT_COUNT = ACTIVE_ITEM_SLOT_COUNT + BACKPACK_ITEM_SLOT_COUNT;

/**
 * Tier -> hero slugs of every primary-board slot (not late-game swaps —
 * those are a plan, not something actually equipped at the same time) that
 * holds a neutral item of that tier, for tiers with 2 or more such slots.
 * In reality only one item per tier (two for the game's level-25 bonus tier)
 * can ever actually drop, so a tier with more than one assigned slot here is
 * a "duplicate" — the board no longer blocks that (DOW-23), but callers use
 * this to flag it visually (glow the slots sharing a tier, list who's
 * competing for it) so the user can see who's really getting that drop.
 */
export function neutralTierDuplicateGroups(
  board: Board,
  neutralItemBySlug: Map<string, NeutralItem>,
): Map<number, string[]> {
  const byTier = new Map<number, string[]>();
  for (const s of board.slots) {
    if (!s.neutralItemSlug || !s.heroSlug) continue;
    const tier = neutralItemBySlug.get(s.neutralItemSlug)?.tier;
    if (tier === undefined) continue;
    const list = byTier.get(tier) ?? [];
    list.push(s.heroSlug);
    byTier.set(tier, list);
  }
  for (const [tier, heroSlugs] of byTier) {
    if (heroSlugs.length < 2) byTier.delete(tier);
  }
  return byTier;
}

export function setBonusNeutralTier(board: Board, tier: 4 | 5): Board {
  return { ...board, bonusNeutralTier: tier };
}

export interface HeroLoadoutSeed {
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
}

/**
 * Places (or clears) a hero in a slot. When placing a hero that has a saved
 * "Core Items" loadout from its hero page (see persistence.ts's
 * HeroItemLoadout), that loadout seeds the slot's items — this is how a
 * hero's build carries over onto the board. Passing no seed (or the hero
 * having no saved loadout) leaves whatever was already in the slot.
 */
export function setHero(board: Board, slotId: string, heroSlug: string | null, seed?: HeroLoadoutSeed | null): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId
        ? {
            ...s,
            heroSlug,
            // Clearing the hero clears whatever it was holding; placing one
            // seeds its saved build if it has one, otherwise leaves items be.
            regularItemSlugs: heroSlug
              ? seed
                ? [...seed.regularItemSlugs]
                : s.regularItemSlugs
              : new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
            neutralItemSlug: heroSlug ? (seed ? seed.neutralItemSlug : s.neutralItemSlug) : null,
            hasScepter: heroSlug ? s.hasScepter : false,
            hasShard: heroSlug ? s.hasShard : false,
          }
        : s,
    ),
  };
}

/**
 * Reads the loadout at a {@link HeroTarget} — a role slot's primary hero, or
 * its late-game swap hero. Null for a late-game target whose slot has no
 * swap card yet (see {@link addLateGameSwap}); a primary target's loadout is
 * always present once its slot exists.
 */
function readTargetLoadout(board: Board, target: HeroTarget): LateGameSwap | null {
  const slot = board.slots.find((s) => s.slotId === target.slotId);
  if (!slot) return null;
  if (target.kind === 'lategame') return slot.lateGameSwap;
  const {
    heroSlug,
    regularItemSlugs,
    neutralItemSlug,
    hasScepter,
    hasShard,
    appliedBuildId,
    regularItemAutocast,
    neutralItemAutocast,
  } = slot;
  return { heroSlug, regularItemSlugs, neutralItemSlug, hasScepter, hasShard, appliedBuildId, regularItemAutocast, neutralItemAutocast };
}

/** Writes a loadout back to a {@link HeroTarget}. A no-op for a late-game
 * target whose slot has no swap card (mirrors {@link readTargetLoadout}). */
function writeTargetLoadout(board: Board, target: HeroTarget, loadout: LateGameSwap): Board {
  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId !== target.slotId) return s;
      if (target.kind === 'primary') return { ...s, ...loadout };
      if (!s.lateGameSwap) return s;
      return { ...s, lateGameSwap: loadout };
    }),
  };
}

export function setRegularItem(
  board: Board,
  target: HeroTarget,
  itemIndex: number,
  itemSlug: string | null,
): Board {
  const current = readTargetLoadout(board, target);
  if (!current) return board;
  const regularItemSlugs = [...current.regularItemSlugs];
  regularItemSlugs[itemIndex] = itemSlug;
  return writeTargetLoadout(board, target, { ...current, regularItemSlugs });
}

export function setNeutralItem(board: Board, target: HeroTarget, itemSlug: string | null): Board {
  const current = readTargetLoadout(board, target);
  if (!current) return board;
  return writeTargetLoadout(board, target, { ...current, neutralItemSlug: itemSlug });
}

/**
 * Loads one of a hero's saved hero-page builds into its board loadout,
 * replacing whatever items/agh flags (including the neutral item) are there
 * now — the board's own "switch build" action for a hero with more than one
 * saved build. Works for either a role slot's primary hero or its late-game
 * swap hero.
 */
export function applyHeroBuild(board: Board, target: HeroTarget, build: HeroBuild): Board {
  const current = readTargetLoadout(board, target);
  if (!current) return board;
  return writeTargetLoadout(board, target, {
    ...current,
    regularItemSlugs: [...build.regularItemSlugs],
    neutralItemSlug: build.neutralItemSlug,
    hasScepter: build.hasScepter,
    hasShard: build.hasShard,
    appliedBuildId: build.id,
    regularItemAutocast: [...build.regularItemAutocast],
    neutralItemAutocast: build.neutralItemAutocast,
  });
}

export function toggleRegularItemAutocast(board: Board, target: HeroTarget, itemIndex: number): Board {
  const current = readTargetLoadout(board, target);
  if (!current) return board;
  const regularItemAutocast = [...current.regularItemAutocast];
  regularItemAutocast[itemIndex] = !regularItemAutocast[itemIndex];
  return writeTargetLoadout(board, target, { ...current, regularItemAutocast });
}

export function toggleNeutralItemAutocast(board: Board, target: HeroTarget): Board {
  const current = readTargetLoadout(board, target);
  if (!current) return board;
  return writeTargetLoadout(board, target, { ...current, neutralItemAutocast: !current.neutralItemAutocast });
}

export function toggleScepter(board: Board, target: HeroTarget): Board {
  const current = readTargetLoadout(board, target);
  if (!current?.heroSlug) return board;
  return writeTargetLoadout(board, target, { ...current, hasScepter: !current.hasScepter });
}

export function toggleShard(board: Board, target: HeroTarget): Board {
  const current = readTargetLoadout(board, target);
  if (!current?.heroSlug) return board;
  return writeTargetLoadout(board, target, { ...current, hasShard: !current.hasShard });
}

// --- Late-game swap: an optional second hero+loadout tracked per role slot,
// for "I'll switch this hero out once we're deep into the game." It lives
// alongside the slot's primary hero, not instead of it, and isn't counted
// against the neutral item cap above — it's a plan, not something actually
// equipped at the same time as the primary loadout.

export function emptyLateGameSwap(): LateGameSwap {
  return {
    heroSlug: null,
    regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
    neutralItemSlug: null,
    hasScepter: false,
    hasShard: false,
    appliedBuildId: null,
    regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
    neutralItemAutocast: false,
  };
}

export function addLateGameSwap(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, lateGameSwap: emptyLateGameSwap() } : s)),
  };
}

export function removeLateGameSwap(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, lateGameSwap: null } : s)),
  };
}

/** Clears the hero (and everything it's holding) from a late-game swap card, keeping the card itself. */
export function clearLateGameHero(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) => (s.slotId === slotId && s.lateGameSwap ? { ...s, lateGameSwap: emptyLateGameSwap() } : s)),
  };
}

// setRegularItem, setNeutralItem, applyHeroBuild, toggleRegularItemAutocast,
// toggleNeutralItemAutocast, toggleScepter and toggleShard above all take a
// HeroTarget, so they cover a late-game swap's loadout too — see DOW-39.
