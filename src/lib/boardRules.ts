import type { Board, LateGameSwap, NeutralItem } from '../types';
import type { HeroBuild } from './persistence';

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

/** Moves a hero (and everything it's holding) between two role slots. If the
 * destination already has a hero, the two slots' heroes+items swap places. */
export function moveHero(board: Board, fromSlotId: string, toSlotId: string): Board {
  if (fromSlotId === toSlotId) return board;
  const from = board.slots.find((s) => s.slotId === fromSlotId);
  const to = board.slots.find((s) => s.slotId === toSlotId);
  if (!from || !to) return board;

  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId === fromSlotId) {
        return {
          ...s,
          heroSlug: to.heroSlug,
          regularItemSlugs: to.regularItemSlugs,
          neutralItemSlug: to.neutralItemSlug,
          hasScepter: to.hasScepter,
          hasShard: to.hasShard,
        };
      }
      if (s.slotId === toSlotId) {
        return {
          ...s,
          heroSlug: from.heroSlug,
          regularItemSlugs: from.regularItemSlugs,
          neutralItemSlug: from.neutralItemSlug,
          hasScepter: from.hasScepter,
          hasShard: from.hasShard,
        };
      }
      return s;
    }),
  };
}

export function setRegularItem(
  board: Board,
  slotId: string,
  itemIndex: number,
  itemSlug: string | null,
): Board {
  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId !== slotId) return s;
      const regularItemSlugs = [...s.regularItemSlugs];
      regularItemSlugs[itemIndex] = itemSlug;
      return { ...s, regularItemSlugs };
    }),
  };
}

export function setNeutralItem(board: Board, slotId: string, itemSlug: string | null): Board {
  return {
    ...board,
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, neutralItemSlug: itemSlug } : s)),
  };
}

/**
 * Loads one of a hero's saved hero-page builds into its board slot, replacing
 * whatever items/agh flags (including the neutral item) are there now — the
 * board's own "switch build" action for a hero with more than one saved
 * build.
 */
export function applyHeroBuild(board: Board, slotId: string, build: HeroBuild): Board {
  const withItems: Board = {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId
        ? {
            ...s,
            regularItemSlugs: [...build.regularItemSlugs],
            hasScepter: build.hasScepter,
            hasShard: build.hasShard,
            appliedBuildId: build.id,
            regularItemAutocast: [...build.regularItemAutocast],
            neutralItemAutocast: build.neutralItemAutocast,
          }
        : s,
    ),
  };
  return setNeutralItem(withItems, slotId, build.neutralItemSlug);
}

export function toggleRegularItemAutocast(board: Board, slotId: string, itemIndex: number): Board {
  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId !== slotId) return s;
      const regularItemAutocast = [...s.regularItemAutocast];
      regularItemAutocast[itemIndex] = !regularItemAutocast[itemIndex];
      return { ...s, regularItemAutocast };
    }),
  };
}

export function toggleNeutralItemAutocast(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, neutralItemAutocast: !s.neutralItemAutocast } : s)),
  };
}

export function toggleScepter(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.heroSlug ? { ...s, hasScepter: !s.hasScepter } : s,
    ),
  };
}

export function toggleShard(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.heroSlug ? { ...s, hasShard: !s.hasShard } : s,
    ),
  };
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

/** Late-game swap counterpart to {@link applyHeroBuild} — no neutral cap check, matching setLateGameNeutralItem. */
export function applyLateGameHeroBuild(board: Board, slotId: string, build: HeroBuild): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap
        ? {
            ...s,
            lateGameSwap: {
              ...s.lateGameSwap,
              regularItemSlugs: [...build.regularItemSlugs],
              neutralItemSlug: build.neutralItemSlug,
              hasScepter: build.hasScepter,
              hasShard: build.hasShard,
              appliedBuildId: build.id,
              regularItemAutocast: [...build.regularItemAutocast],
              neutralItemAutocast: build.neutralItemAutocast,
            },
          }
        : s,
    ),
  };
}

export function toggleLateGameRegularItemAutocast(board: Board, slotId: string, itemIndex: number): Board {
  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId !== slotId || !s.lateGameSwap) return s;
      const regularItemAutocast = [...s.lateGameSwap.regularItemAutocast];
      regularItemAutocast[itemIndex] = !regularItemAutocast[itemIndex];
      return { ...s, lateGameSwap: { ...s.lateGameSwap, regularItemAutocast } };
    }),
  };
}

export function toggleLateGameNeutralItemAutocast(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap
        ? { ...s, lateGameSwap: { ...s.lateGameSwap, neutralItemAutocast: !s.lateGameSwap.neutralItemAutocast } }
        : s,
    ),
  };
}

export function setLateGameRegularItem(
  board: Board,
  slotId: string,
  itemIndex: number,
  itemSlug: string | null,
): Board {
  return {
    ...board,
    slots: board.slots.map((s) => {
      if (s.slotId !== slotId || !s.lateGameSwap) return s;
      const regularItemSlugs = [...s.lateGameSwap.regularItemSlugs];
      regularItemSlugs[itemIndex] = itemSlug;
      return { ...s, lateGameSwap: { ...s.lateGameSwap, regularItemSlugs } };
    }),
  };
}

export function setLateGameNeutralItem(board: Board, slotId: string, itemSlug: string | null): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap ? { ...s, lateGameSwap: { ...s.lateGameSwap, neutralItemSlug: itemSlug } } : s,
    ),
  };
}

export function toggleLateGameScepter(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap?.heroSlug
        ? { ...s, lateGameSwap: { ...s.lateGameSwap, hasScepter: !s.lateGameSwap.hasScepter } }
        : s,
    ),
  };
}

export function toggleLateGameShard(board: Board, slotId: string): Board {
  return {
    ...board,
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap?.heroSlug
        ? { ...s, lateGameSwap: { ...s.lateGameSwap, hasShard: !s.lateGameSwap.hasShard } }
        : s,
    ),
  };
}
