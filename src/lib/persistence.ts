import type { Board, BoardSlot, SavedStrategy } from '../types';
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
// Set once someone picks "Continue as Guest" on the login gate, so it
// doesn't ask again on this browser. Cleared on sign-out along with the
// rest of the account-scoped data, so signing out returns to the gate.
const GUEST_MODE_KEY = 'dow-planner:guest-mode';
// Whether the item shop sidebar is open — shared across the board and the
// hero pages so it doesn't reopen itself every time navigation remounts
// whichever page's ItemShopDock/PlannerPage instance owns the toggle.
const SHOP_OPEN_KEY = 'dow-planner:shop-open';

export function emptyBoard(): Board {
  return {
    slots: ROLE_SLOTS.map((slot) => ({
      slotId: slot.id,
      heroSlug: null,
      regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
      neutralItemSlug: null,
      hasScepter: false,
      hasShard: false,
      lateGameSwap: null,
    })),
    bonusNeutralTier: 5,
  };
}

function normalizeLateGameSwap(swap: BoardSlot['lateGameSwap']): BoardSlot['lateGameSwap'] {
  if (!swap) return null;
  const slugs = (swap.regularItemSlugs ?? []).slice(0, REGULAR_ITEM_SLOT_COUNT);
  while (slugs.length < REGULAR_ITEM_SLOT_COUNT) slugs.push(null);
  return {
    heroSlug: swap.heroSlug ?? null,
    regularItemSlugs: slugs,
    neutralItemSlug: swap.neutralItemSlug ?? null,
    hasScepter: swap.hasScepter ?? false,
    hasShard: swap.hasShard ?? false,
  };
}

// Pads/truncates regularItemSlugs to the current length, and backfills
// hasScepter/hasShard/lateGameSwap/bonusNeutralTier, for boards saved
// before those fields existed.
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
        lateGameSwap: normalizeLateGameSwap(s.lateGameSwap),
      };
    }),
    bonusNeutralTier: board.bonusNeutralTier === 4 ? 4 : 5,
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

/**
 * Clears the active board and hero item loadouts — called on sign-out so a
 * signed-in account's data doesn't linger in this browser for whoever uses
 * it next. Saved strategies are left alone: they're a deliberate, named save
 * rather than ambient session state, and aren't account-synced.
 */
export function clearAccountScopedLocalData(): void {
  localStorage.removeItem(ACTIVE_BOARD_KEY);
  localStorage.removeItem(HERO_AGH_KEY);
  localStorage.removeItem(HERO_LOADOUT_KEY);
  localStorage.removeItem(GUEST_MODE_KEY);
}

/** Whether this browser already chose "Continue as Guest" on the login gate. */
export function isGuestMode(): boolean {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

export function setGuestMode(): void {
  localStorage.setItem(GUEST_MODE_KEY, 'true');
}

/** Clears the guest choice so the login gate reappears (the "back to login page" nav button). */
export function clearGuestMode(): void {
  localStorage.removeItem(GUEST_MODE_KEY);
}

/** Defaults to open — matches the shop panel's original always-open behavior. */
export function loadShopOpen(): boolean {
  const raw = localStorage.getItem(SHOP_OPEN_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

export function saveShopOpen(open: boolean): void {
  localStorage.setItem(SHOP_OPEN_KEY, String(open));
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

export const SITUATIONAL_ITEM_SLOT_COUNT = 6;
export const SITUATIONAL_NEUTRAL_SLOT_COUNT = 2;

export interface HeroItemLoadout {
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  /** Freeform "my own situational picks" slots — separate from the hero's static reference list. */
  situationalItemSlugs: (string | null)[];
  situationalNeutralItemSlugs: (string | null)[];
  note: string;
}

export function emptyHeroItemLoadout(): HeroItemLoadout {
  return {
    regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
    neutralItemSlug: null,
    situationalItemSlugs: new Array(SITUATIONAL_ITEM_SLOT_COUNT).fill(null),
    situationalNeutralItemSlugs: new Array(SITUATIONAL_NEUTRAL_SLOT_COUNT).fill(null),
    note: '',
  };
}

function padSlots(slugs: (string | null)[] | undefined, count: number): (string | null)[] {
  const result = (slugs ?? []).slice(0, count);
  while (result.length < count) result.push(null);
  return result;
}

function normalizeHeroItemLoadout(loadout: HeroItemLoadout): HeroItemLoadout {
  return {
    regularItemSlugs: padSlots(loadout.regularItemSlugs, REGULAR_ITEM_SLOT_COUNT),
    neutralItemSlug: loadout.neutralItemSlug ?? null,
    situationalItemSlugs: padSlots(loadout.situationalItemSlugs, SITUATIONAL_ITEM_SLOT_COUNT),
    situationalNeutralItemSlugs: padSlots(loadout.situationalNeutralItemSlugs, SITUATIONAL_NEUTRAL_SLOT_COUNT),
    note: loadout.note ?? '',
  };
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
