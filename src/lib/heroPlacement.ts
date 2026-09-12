import type { Board } from '../types';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';
import { loadHeroBuilds } from './persistence';
import { MULTI_INSTANCE_HERO_SLUGS } from '../data/multiInstanceHeroes';

/** Addresses either a role slot's primary hero or its late-game swap hero. */
export type HeroTarget = { kind: 'primary'; slotId: string } | { kind: 'lategame'; slotId: string };

interface HeroLoadoutState {
  heroSlug: string | null;
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  hasScepter: boolean;
  hasShard: boolean;
  appliedBuildId: string | null;
  regularItemAutocast: boolean[];
  neutralItemAutocast: boolean;
}

function findHero(board: Board, heroSlug: string): HeroTarget | null {
  for (const s of board.slots) {
    if (s.heroSlug === heroSlug) return { kind: 'primary', slotId: s.slotId };
    if (s.lateGameSwap?.heroSlug === heroSlug) return { kind: 'lategame', slotId: s.slotId };
  }
  return null;
}

/**
 * Finds the first target (primary slots in board order, then late-game swap
 * slots in board order) that has no hero, other than `exclude` itself — a
 * displacement spot for a hero that's about to be bumped off `exclude`.
 */
function findFirstEmptySlot(board: Board, exclude: HeroTarget): HeroTarget | null {
  for (const s of board.slots) {
    if (s.heroSlug === null && !(exclude.kind === 'primary' && exclude.slotId === s.slotId)) {
      return { kind: 'primary', slotId: s.slotId };
    }
  }
  for (const s of board.slots) {
    if (s.lateGameSwap && s.lateGameSwap.heroSlug === null && !(exclude.kind === 'lategame' && exclude.slotId === s.slotId)) {
      return { kind: 'lategame', slotId: s.slotId };
    }
  }
  return null;
}

function emptyLoadout(heroSlug: string): HeroLoadoutState {
  return {
    heroSlug,
    regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
    neutralItemSlug: null,
    hasScepter: false,
    hasShard: false,
    appliedBuildId: null,
    regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
    neutralItemAutocast: false,
  };
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
      appliedBuildId: slot.appliedBuildId,
      regularItemAutocast: slot.regularItemAutocast,
      neutralItemAutocast: slot.neutralItemAutocast,
    };
  }
  const swap = slot.lateGameSwap;
  return swap
    ? {
        heroSlug: swap.heroSlug,
        regularItemSlugs: swap.regularItemSlugs,
        neutralItemSlug: swap.neutralItemSlug,
        hasScepter: swap.hasScepter,
        hasShard: swap.hasShard,
        appliedBuildId: swap.appliedBuildId,
        regularItemAutocast: swap.regularItemAutocast,
        neutralItemAutocast: swap.neutralItemAutocast,
      }
    : {
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

function writeLoadout(board: Board, target: HeroTarget, loadout: HeroLoadoutState): Board {
  return {
    ...board,
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
 * seeds its items from its saved "Core Items" build (whichever build tab
 * was last active on its hero page), if it has one.
 *
 * If the incoming hero isn't on the board at all (e.g. dragged from the
 * Hero Tray) and the target is already occupied by a *different* hero, that
 * occupant is displaced (with its full loadout intact) to the first open
 * slot elsewhere on the board, rather than being silently overwritten —
 * only if the board is entirely full does it fall back to being replaced.
 *
 * Exception: heroes in {@link MULTI_INSTANCE_HERO_SLUGS} (Arc Warden) are
 * never relocated this way — each placement is treated as a fresh one, so
 * the hero can occupy more than one slot on the board at the same time.
 */
export function placeHeroAt(board: Board, target: HeroTarget, heroSlug: string): Board {
  const existing = MULTI_INSTANCE_HERO_SLUGS.includes(heroSlug) ? null : findHero(board, heroSlug);

  if (existing) {
    if (existing.kind === target.kind && existing.slotId === target.slotId) return board;
    const existingLoadout = readLoadout(board, existing);
    const targetLoadout = readLoadout(board, target);
    let next = writeLoadout(board, target, existingLoadout);
    next = writeLoadout(next, existing, targetLoadout);
    return next;
  }

  const heroBuildState = loadHeroBuilds()[heroSlug];
  const saved = heroBuildState?.builds.find((b) => b.id === heroBuildState.activeBuildId);
  const hasSavedItems = saved && (saved.regularItemSlugs.some((s) => s !== null) || saved.neutralItemSlug !== null);
  const targetLoadout = readLoadout(board, target);
  const targetOccupied = targetLoadout.heroSlug !== null;

  const seeded: HeroLoadoutState = hasSavedItems
    ? {
        heroSlug,
        regularItemSlugs: [...saved.regularItemSlugs],
        neutralItemSlug: saved.neutralItemSlug,
        hasScepter: saved.hasScepter,
        hasShard: saved.hasShard,
        appliedBuildId: saved.id,
        regularItemAutocast: [...saved.regularItemAutocast],
        neutralItemAutocast: saved.neutralItemAutocast,
      }
    : targetOccupied
      ? emptyLoadout(heroSlug) // target's items belong to its current occupant, not the incoming hero
      : { ...targetLoadout, heroSlug };

  if (targetOccupied) {
    const displaced = findFirstEmptySlot(board, target);
    if (displaced) {
      const next = writeLoadout(board, displaced, targetLoadout);
      return writeLoadout(next, target, seeded);
    }
  }
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
