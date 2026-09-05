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
// Superseded by HERO_BUILDS_KEY (multiple named builds per hero); kept only
// as a one-time migration source for browsers that saved under the old shape.
const HERO_LOADOUT_KEY = 'dow-planner:hero-loadout';
// One or more named item builds per hero (e.g. "Aghs Carry", "Support"),
// shown as tabs on the hero page. Replaces HERO_LOADOUT_KEY/HERO_AGH_KEY,
// which stored exactly one loadout and one set of agh flags per hero.
const HERO_BUILDS_KEY = 'dow-planner:hero-builds';
// Set once someone picks "Continue as Guest" on the login gate, so it
// doesn't ask again on this browser. Cleared on sign-out along with the
// rest of the account-scoped data, so signing out returns to the gate.
const GUEST_MODE_KEY = 'dow-planner:guest-mode';
// Whether the item shop sidebar is open — shared across the board and the
// hero pages so it doesn't reopen itself every time navigation remounts
// whichever page's ItemShopDock/PlannerPage instance owns the toggle.
const SHOP_OPEN_KEY = 'dow-planner:shop-open';
// Whether the main board is split into two columns (roles 6-9 in a second
// column) — persisted so it survives navigating to the heroes section and
// back, which remounts PlannerPage and would otherwise reset it (DOW-27).
const TWO_COLUMNS_KEY = 'dow-planner:board-two-columns';
// Which of the 7 fixed COMBO_HERO_SLUGS heroes' special abilities (each
// unique, each usable on any hero — Lycan's bite, Snapfire's cannonball,
// etc.) can target each hero (DOW-10) — heroSlug -> array of giver hero
// slugs. Shown on every hero's page, one-directional (see
// toggleHeroComboGiver below).
const HERO_COMBO_KEY = 'dow-planner:hero-combos';

function padBooleans(arr: boolean[] | undefined, count: number): boolean[] {
  const result = (arr ?? []).slice(0, count);
  while (result.length < count) result.push(false);
  return result;
}

export function emptyBoard(): Board {
  return {
    slots: ROLE_SLOTS.map((slot) => ({
      slotId: slot.id,
      heroSlug: null,
      regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
      neutralItemSlug: null,
      hasScepter: false,
      hasShard: false,
      appliedBuildId: null,
      regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
      neutralItemAutocast: false,
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
    appliedBuildId: swap.appliedBuildId ?? null,
    regularItemAutocast: padBooleans(swap.regularItemAutocast, REGULAR_ITEM_SLOT_COUNT),
    neutralItemAutocast: swap.neutralItemAutocast ?? false,
  };
}

// Pads/truncates regularItemSlugs to the current length, and backfills
// hasScepter/hasShard/appliedBuildId/autocast flags/lateGameSwap/
// bonusNeutralTier, for boards saved before those fields existed.
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
        appliedBuildId: s.appliedBuildId ?? null,
        regularItemAutocast: padBooleans(s.regularItemAutocast, REGULAR_ITEM_SLOT_COUNT),
        neutralItemAutocast: s.neutralItemAutocast ?? false,
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
  localStorage.removeItem(HERO_BUILDS_KEY);
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

/** Defaults to one column — matches the board's original single-column layout. */
export function loadTwoColumns(): boolean {
  return localStorage.getItem(TWO_COLUMNS_KEY) === 'true';
}

export function saveTwoColumns(twoColumns: boolean): void {
  localStorage.setItem(TWO_COLUMNS_KEY, String(twoColumns));
}

// --- Everything below this point through loadLegacyHeroItemLoadouts is the
// pre-multi-build shape (one loadout + one agh-flags record per hero). Kept
// private, read-only, and unexported: migrateLegacyHeroBuilds() is the only
// caller, folding old data into the new HeroBuild shape the first time a
// browser's builds are loaded after this feature shipped.

interface LegacyHeroAghFlags {
  coreScepter: boolean;
  coreShard: boolean;
}

function loadLegacyHeroAghFlags(): Record<string, LegacyHeroAghFlags> {
  const raw = localStorage.getItem(HERO_AGH_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LegacyHeroAghFlags>;
  } catch {
    return {};
  }
}

export const SITUATIONAL_ITEM_SLOT_COUNT = 6;
export const SITUATIONAL_NEUTRAL_SLOT_COUNT = 2;

interface LegacyHeroItemLoadout {
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  situationalItemSlugs: (string | null)[];
  situationalNeutralItemSlugs: (string | null)[];
  note: string;
}

function padSlots(slugs: (string | null)[] | undefined, count: number): (string | null)[] {
  const result = (slugs ?? []).slice(0, count);
  while (result.length < count) result.push(null);
  return result;
}

function normalizeLegacyHeroItemLoadout(loadout: LegacyHeroItemLoadout): LegacyHeroItemLoadout {
  return {
    regularItemSlugs: padSlots(loadout.regularItemSlugs, REGULAR_ITEM_SLOT_COUNT),
    neutralItemSlug: loadout.neutralItemSlug ?? null,
    situationalItemSlugs: padSlots(loadout.situationalItemSlugs, SITUATIONAL_ITEM_SLOT_COUNT),
    situationalNeutralItemSlugs: padSlots(loadout.situationalNeutralItemSlugs, SITUATIONAL_NEUTRAL_SLOT_COUNT),
    note: loadout.note ?? '',
  };
}

function loadLegacyHeroItemLoadouts(): Record<string, LegacyHeroItemLoadout> {
  const raw = localStorage.getItem(HERO_LOADOUT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, LegacyHeroItemLoadout>;
    const normalized: Record<string, LegacyHeroItemLoadout> = {};
    for (const [slug, loadout] of Object.entries(parsed)) {
      if (!loadout || !Array.isArray(loadout.regularItemSlugs)) continue;
      normalized[slug] = normalizeLegacyHeroItemLoadout(loadout);
    }
    return normalized;
  } catch {
    return {};
  }
}

export interface HeroBuild {
  id: string;
  name: string;
  regularItemSlugs: (string | null)[];
  neutralItemSlug: string | null;
  /** Freeform "my own situational picks" slots — separate from the hero's static reference list. */
  situationalItemSlugs: (string | null)[];
  situationalNeutralItemSlugs: (string | null)[];
  note: string;
  hasScepter: boolean;
  hasShard: boolean;
  /** Per-slot "autocast enabled" flags for the Core Items only, index-matched
   * to regularItemSlugs — situational items don't support autocast. */
  regularItemAutocast: boolean[];
  neutralItemAutocast: boolean;
}

export interface HeroBuildState {
  builds: HeroBuild[];
  activeBuildId: string;
}

export function newHeroBuild(name: string): HeroBuild {
  return {
    id: crypto.randomUUID(),
    name,
    regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
    neutralItemSlug: null,
    situationalItemSlugs: new Array(SITUATIONAL_ITEM_SLOT_COUNT).fill(null),
    situationalNeutralItemSlugs: new Array(SITUATIONAL_NEUTRAL_SLOT_COUNT).fill(null),
    note: '',
    hasScepter: false,
    hasShard: false,
    regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
    neutralItemAutocast: false,
  };
}

export function emptyHeroBuildState(): HeroBuildState {
  const build = newHeroBuild('Build 1');
  return { builds: [build], activeBuildId: build.id };
}

function normalizeHeroBuild(build: Partial<HeroBuild> & { id: string }): HeroBuild {
  return {
    id: build.id,
    name: build.name || 'Build 1',
    regularItemSlugs: padSlots(build.regularItemSlugs, REGULAR_ITEM_SLOT_COUNT),
    neutralItemSlug: build.neutralItemSlug ?? null,
    situationalItemSlugs: padSlots(build.situationalItemSlugs, SITUATIONAL_ITEM_SLOT_COUNT),
    situationalNeutralItemSlugs: padSlots(build.situationalNeutralItemSlugs, SITUATIONAL_NEUTRAL_SLOT_COUNT),
    note: build.note ?? '',
    hasScepter: build.hasScepter ?? false,
    hasShard: build.hasShard ?? false,
    regularItemAutocast: padBooleans(build.regularItemAutocast, REGULAR_ITEM_SLOT_COUNT),
    neutralItemAutocast: build.neutralItemAutocast ?? false,
  };
}

/**
 * One-time upgrade path: heroes saved before multi-build support only have
 * a single loadout (HERO_LOADOUT_KEY) and separate agh flags (HERO_AGH_KEY).
 * Folds each into a single "Build 1" so existing saved builds aren't lost.
 */
function migrateLegacyHeroBuilds(): Record<string, HeroBuildState> {
  const legacyLoadouts = loadLegacyHeroItemLoadouts();
  const legacyFlags = loadLegacyHeroAghFlags();
  const result: Record<string, HeroBuildState> = {};
  for (const [heroSlug, loadout] of Object.entries(legacyLoadouts)) {
    const flags = legacyFlags[heroSlug];
    const build = normalizeHeroBuild({
      id: crypto.randomUUID(),
      name: 'Build 1',
      ...loadout,
      hasScepter: flags?.coreScepter ?? false,
      hasShard: flags?.coreShard ?? false,
    });
    result[heroSlug] = { builds: [build], activeBuildId: build.id };
  }
  if (Object.keys(result).length > 0) {
    localStorage.removeItem(HERO_LOADOUT_KEY);
    localStorage.removeItem(HERO_AGH_KEY);
  }
  return result;
}

export function loadHeroBuilds(): Record<string, HeroBuildState> {
  const raw = localStorage.getItem(HERO_BUILDS_KEY);
  if (raw === null) return migrateLegacyHeroBuilds();
  try {
    const parsed = JSON.parse(raw) as Record<string, HeroBuildState>;
    const normalized: Record<string, HeroBuildState> = {};
    for (const [slug, state] of Object.entries(parsed)) {
      if (!state?.builds?.length) continue;
      const builds = state.builds.map((b) => normalizeHeroBuild(b));
      const activeBuildId = builds.some((b) => b.id === state.activeBuildId) ? state.activeBuildId : builds[0].id;
      normalized[slug] = { builds, activeBuildId };
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveHeroBuilds(builds: Record<string, HeroBuildState>): void {
  localStorage.setItem(HERO_BUILDS_KEY, JSON.stringify(builds));
}

export function loadHeroCombos(): Record<string, string[]> {
  const raw = localStorage.getItem(HERO_COMBO_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const normalized: Record<string, string[]> = {};
    for (const [slug, partners] of Object.entries(parsed)) {
      if (Array.isArray(partners)) normalized[slug] = partners;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveHeroCombos(combos: Record<string, string[]>): void {
  localStorage.setItem(HERO_COMBO_KEY, JSON.stringify(combos));
}

/**
 * Toggles whether `giverSlug` (one of the fixed COMBO_HERO_SLUGS) can target
 * `heroSlug` with its special ability — one-directional: giver A being able
 * to target hero B says nothing about whether B (if also a giver) can target
 * A back, since each of the 7 has its own distinct ability.
 */
export function toggleHeroComboGiver(
  combos: Record<string, string[]>,
  heroSlug: string,
  giverSlug: string,
): Record<string, string[]> {
  const list = combos[heroSlug] ?? [];
  const isOn = list.includes(giverSlug);
  return {
    ...combos,
    [heroSlug]: isOn ? list.filter((s) => s !== giverSlug) : [...list, giverSlug],
  };
}
