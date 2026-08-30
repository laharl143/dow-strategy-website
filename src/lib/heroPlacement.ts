import type { Board } from '../types';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';
import { loadHeroItemLoadouts } from './persistence';

/** Addresses either a role slot's primary hero or its late-game swap hero. */
export type HeroTarget = { kind: 'primary'; slotId: string } | { kind: 'lategame'; slotId: string };

interface HeroLoadoutState {
  heroSlug: string | null;
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  hasScepter: boolean;
  hasShard: boolean;
}

function findHero(board: Board, heroSlug: string): HeroTarget | null {
  for (const s of board.slots) {
    if (s.heroSlug === heroSlug) return { kind: 'primary', slotId: s.slotId };
    if (s.lateGameSwap?.heroSlug === heroSlug) return { kind: 'lategame', slotId: s.slotId };
  }
  return null;
}

function readLoadout(board: Board, target: HeroTarget): HeroLoadoutState {
  const slot = board.slots.find((s) => s.slotId === target.slotId)!;
  if (target.kind === 'primary') {
    return {
      heroSlug: slot.heroSlug,
      regularItemSlugs: slot.regularItemSlugs,
      neutralItemSlug: slot.neutralItemSlug,
      hasScepter: slot.hasScepter,
      hasShard: slot.hasShard,
    };
  }
  const swap = slot.lateGameSwap;
  return swap
    ? { heroSlug: swap.heroSlug, regularItemSlugs: swap.regularItemSlugs, neutralItemSlug: swap.neutralItemSlug, hasScepter: swap.hasScepter, hasShard: swap.hasShard }
    : { heroSlug: null, regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null), neutralItemSlug: null, hasScepter: false, hasShard: false };
}

function writeLoadout(board: Board, target: HeroTarget, loadout: HeroLoadoutState): Board {
  return {
    slots: board.slots.map((s) => {
      if (s.slotId !== target.slotId) return s;
      if (target.kind === 'primary') {
        return { ...s, ...loadout };
      }
      // A late-game slot must already exist (created via the "+" button) to
      // receive a hero — this is a no-op guard, not an expected path.
      if (!s.lateGameSwap) return s;
      return { ...s, lateGameSwap: { ...s.lateGameSwap, ...loadout } };
    }),
  };
}

/**
 * Places a hero at a target (a role slot's primary hero, or its late-game
 * swap hero) — shared by drag-and-drop and the click-to-search picker. A
 * hero can only be on the board once, whether as a primary or a late-game
 * swap: if it's already somewhere else, this relocates it (and everything
 * it's holding) there instead of creating a duplicate — swapping with
 * whatever was already at the target, if anything. A freshly-placed hero
 * seeds its items from its saved "Core Items" build, if it has one.
 */
export function placeHeroAt(board: Board, target: HeroTarget, heroSlug: string): Board {
  const existing = findHero(board, heroSlug);

  if (existing) {
    if (existing.kind === target.kind && existing.slotId === target.slotId) return board;
    const existingLoadout = readLoadout(board, existing);
    const targetLoadout = readLoadout(board, target);
    let next = writeLoadout(board, target, existingLoadout);
    next = writeLoadout(next, existing, targetLoadout);
    return next;
  }

  const saved = loadHeroItemLoadouts()[heroSlug];
  const hasSavedItems = saved && (saved.regularItemSlugs.some((s) => s !== null) || saved.neutralItemSlug !== null);
  const seeded: HeroLoadoutState = hasSavedItems
    ? { heroSlug, regularItemSlugs: [...saved.regularItemSlugs], neutralItemSlug: saved.neutralItemSlug, hasScepter: false, hasShard: false }
    : { ...readLoadout(board, target), heroSlug };
  return writeLoadout(board, target, seeded);
}

/** Places a hero into a role slot's primary spot. See {@link placeHeroAt}. */
export function placeHeroInSlot(board: Board, slotId: string, heroSlug: string): Board {
  return placeHeroAt(board, { kind: 'primary', slotId }, heroSlug);
}

/** Places a hero into a role slot's late-game swap spot. See {@link placeHeroAt}. */
export function placeHeroInLateGameSlot(board: Board, slotId: string, heroSlug: string): Board {
  return placeHeroAt(board, { kind: 'lategame', slotId }, heroSlug);
}
