import type { Board, LateGameSwap } from '../types';

// Neutral items: global cap of 6 across the whole board, at most 1 per hero.
// See CONTEXT.md "Neutral Item". No per-tier limit yet (round 2 grill decision).
export const NEUTRAL_ITEM_CAP = 6;

// A hero's inventory: 6 active item slots + a 3-slot backpack, matching Dota 2's
// own layout. Index 0-5 = active, 6-8 = backpack.
export const ACTIVE_ITEM_SLOT_COUNT = 6;
export const BACKPACK_ITEM_SLOT_COUNT = 3;
export const REGULAR_ITEM_SLOT_COUNT = ACTIVE_ITEM_SLOT_COUNT + BACKPACK_ITEM_SLOT_COUNT;

export function countAssignedNeutrals(board: Board): number {
  return board.slots.filter((s) => s.neutralItemSlug !== null).length;
}

export function canAssignNeutral(board: Board, slotId: string): boolean {
  const slot = board.slots.find((s) => s.slotId === slotId);
  if (!slot) return false;
  if (slot.heroSlug === null) return false; // no hero to hold it
  if (slot.neutralItemSlug !== null) return true; // replacing own item is fine
  return countAssignedNeutrals(board) < NEUTRAL_ITEM_CAP;
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
    slots: board.slots.map((s) => {
      if (s.slotId !== slotId) return s;
      const regularItemSlugs = [...s.regularItemSlugs];
      regularItemSlugs[itemIndex] = itemSlug;
      return { ...s, regularItemSlugs };
    }),
  };
}

export function setNeutralItem(board: Board, slotId: string, itemSlug: string | null): Board {
  if (itemSlug !== null && !canAssignNeutral(board, slotId)) return board;
  return {
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, neutralItemSlug: itemSlug } : s)),
  };
}

export function toggleScepter(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.heroSlug ? { ...s, hasScepter: !s.hasScepter } : s,
    ),
  };
}

export function toggleShard(board: Board, slotId: string): Board {
  return {
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
  };
}

export function addLateGameSwap(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, lateGameSwap: emptyLateGameSwap() } : s)),
  };
}

export function removeLateGameSwap(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) => (s.slotId === slotId ? { ...s, lateGameSwap: null } : s)),
  };
}

/** Clears the hero (and everything it's holding) from a late-game swap card, keeping the card itself. */
export function clearLateGameHero(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) => (s.slotId === slotId && s.lateGameSwap ? { ...s, lateGameSwap: emptyLateGameSwap() } : s)),
  };
}

export function setLateGameRegularItem(
  board: Board,
  slotId: string,
  itemIndex: number,
  itemSlug: string | null,
): Board {
  return {
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
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap ? { ...s, lateGameSwap: { ...s.lateGameSwap, neutralItemSlug: itemSlug } } : s,
    ),
  };
}

export function toggleLateGameScepter(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap?.heroSlug
        ? { ...s, lateGameSwap: { ...s.lateGameSwap, hasScepter: !s.lateGameSwap.hasScepter } }
        : s,
    ),
  };
}

export function toggleLateGameShard(board: Board, slotId: string): Board {
  return {
    slots: board.slots.map((s) =>
      s.slotId === slotId && s.lateGameSwap?.heroSlug
        ? { ...s, lateGameSwap: { ...s.lateGameSwap, hasShard: !s.lateGameSwap.hasShard } }
        : s,
    ),
  };
}
