import type { Board, SavedStrategy } from '../types';
import { ROLE_SLOTS } from '../data/roleSlots';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';

// Every read/write of stored data goes through this module. Nothing else in
// the app touches localStorage directly. See docs/adr/0001-static-spa-no-backend.md:
// this is the seam that keeps a future backend migration cheap.

const ACTIVE_BOARD_KEY = 'dow-planner:active-board';
const STRATEGIES_KEY = 'dow-planner:saved-strategies';
// Per-hero "does this hero's core build want Scepter/Shard" flags, shown on
// each hero's page. Hero data itself is static bundled JSON, so this — like
// the board's own toggle — lives in localStorage rather than heroes.json.
const HERO_AGH_KEY = 'dow-planner:hero-agh';
// Per-hero "my current build" item loadout shown on each hero's page — a
// personal scratchpad separate from the board, and separate from the
// hero's static coreItemSlugs/situationalItemSlugs reference list.
const HERO_LOADOUT_KEY = 'dow-planner:hero-loadout';

export function emptyBoard(): Board {
  return {
    slots: ROLE_SLOTS.map((slot) => ({
      slotId: slot.id,
      heroSlug: null,
      regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
      neutralItemSlug: null,
      hasScepter: false,
      hasShard: false,
    })),
  };
}

// Pads/truncates regularItemSlugs to the current length, and backfills
// hasScepter/hasShard, for boards saved before those fields existed.
export function normalizeBoard(board: Board): Board {
  return {
    slots: board.slots.map((s) => {
      const slugs = s.regularItemSlugs.slice(0, REGULAR_ITEM_SLOT_COUNT);
      while (slugs.length < REGULAR_ITEM_SLOT_COUNT) slugs.push(null);
      return {
        ...s,
        regularItemSlugs: slugs,
        hasScepter: s.hasScepter ?? false,
        hasShard: s.hasShard ?? false,
      };
    }),
  };
}

export function loadActiveBoard(): Board {
  const raw = localStorage.getItem(ACTIVE_BOARD_KEY);
  if (!raw) return emptyBoard();
  try {
    return normalizeBoard(JSON.parse(raw) as Board);
  } catch {
    return emptyBoard();
  }
}

export function saveActiveBoard(board: Board): void {
  localStorage.setItem(ACTIVE_BOARD_KEY, JSON.stringify(board));
}

export function newGame(): Board {
  const board = emptyBoard();
  saveActiveBoard(board);
  return board;
}

export function listSavedStrategies(): SavedStrategy[] {
  const raw = localStorage.getItem(STRATEGIES_KEY);
  if (!raw) return [];
  try {
    const strategies = JSON.parse(raw) as SavedStrategy[];
    return strategies.map((s) => ({ ...s, board: normalizeBoard(s.board) }));
  } catch {
    return [];
  }
}

function persistStrategies(strategies: SavedStrategy[]): void {
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
}

export function saveStrategy(name: string, board: Board): SavedStrategy {
  const strategies = listSavedStrategies();
  const now = new Date().toISOString();
  const strategy: SavedStrategy = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    board,
  };
  persistStrategies([...strategies, strategy]);
  return strategy;
}

export function updateStrategy(id: string, board: Board): void {
  const strategies = listSavedStrategies();
  persistStrategies(
    strategies.map((s) =>
      s.id === id ? { ...s, board, updatedAt: new Date().toISOString() } : s,
    ),
  );
}

export function renameStrategy(id: string, name: string): void {
  const strategies = listSavedStrategies();
  persistStrategies(
    strategies.map((s) => (s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s)),
  );
}

export function deleteStrategy(id: string): void {
  const strategies = listSavedStrategies();
  persistStrategies(strategies.filter((s) => s.id !== id));
}

export interface HeroAghFlags {
  coreScepter: boolean;
  coreShard: boolean;
}

export function loadHeroAghFlags(): Record<string, HeroAghFlags> {
  const raw = localStorage.getItem(HERO_AGH_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, HeroAghFlags>;
  } catch {
    return {};
  }
}

export function saveHeroAghFlags(flags: Record<string, HeroAghFlags>): void {
  localStorage.setItem(HERO_AGH_KEY, JSON.stringify(flags));
}

export interface HeroItemLoadout {
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
}

export function emptyHeroItemLoadout(): HeroItemLoadout {
  return { regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null), neutralItemSlug: null };
}

function normalizeHeroItemLoadout(loadout: HeroItemLoadout): HeroItemLoadout {
  const slugs = (loadout.regularItemSlugs ?? []).slice(0, REGULAR_ITEM_SLOT_COUNT);
  while (slugs.length < REGULAR_ITEM_SLOT_COUNT) slugs.push(null);
  return { regularItemSlugs: slugs, neutralItemSlug: loadout.neutralItemSlug ?? null };
}

export function loadHeroItemLoadouts(): Record<string, HeroItemLoadout> {
  const raw = localStorage.getItem(HERO_LOADOUT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, HeroItemLoadout>;
    const normalized: Record<string, HeroItemLoadout> = {};
    for (const [slug, loadout] of Object.entries(parsed)) {
      if (!loadout || !Array.isArray(loadout.regularItemSlugs)) continue;
      normalized[slug] = normalizeHeroItemLoadout(loadout);
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveHeroItemLoadouts(loadouts: Record<string, HeroItemLoadout>): void {
  localStorage.setItem(HERO_LOADOUT_KEY, JSON.stringify(loadouts));
}
