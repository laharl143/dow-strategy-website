import { describe, it, expect, beforeEach } from 'vitest';
import type { Board } from '../types';
import { ROLE_SLOTS } from '../data/roleSlots';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';
import {
  emptyBoard,
  normalizeBoard,
  loadActiveBoard,
  saveActiveBoard,
  loadHeroBuilds,
  saveHeroBuilds,
  loadHeroCombos,
  saveHeroCombos,
  toggleHeroComboGiver,
} from './persistence';

beforeEach(() => {
  localStorage.clear();
});

describe('emptyBoard', () => {
  it('creates one slot per role slot definition, fully defaulted', () => {
    const b = emptyBoard();
    expect(b.slots).toHaveLength(ROLE_SLOTS.length);
    expect(b.bonusNeutralTier).toBe(5);
    for (const slot of b.slots) {
      expect(slot.heroSlug).toBeNull();
      expect(slot.regularItemSlugs).toHaveLength(REGULAR_ITEM_SLOT_COUNT);
      expect(slot.lateGameSwap).toBeNull();
    }
  });
});

describe('normalizeBoard', () => {
  it('pads a shorter regularItemSlugs array up to the current slot count', () => {
    const legacy = {
      bonusNeutralTier: 5,
      slots: [
        {
          slotId: ROLE_SLOTS[0].id,
          heroSlug: 'axe',
          regularItemSlugs: ['blink'],
          neutralItemSlug: null,
        },
      ],
    } as unknown as Board;

    const normalized = normalizeBoard(legacy);
    expect(normalized.slots[0].regularItemSlugs).toHaveLength(REGULAR_ITEM_SLOT_COUNT);
    expect(normalized.slots[0].regularItemSlugs[0]).toBe('blink');
  });

  it('backfills hasScepter/hasShard/appliedBuildId/autocast flags missing on an old saved shape', () => {
    const legacy = {
      bonusNeutralTier: 5,
      slots: [{ slotId: ROLE_SLOTS[0].id, heroSlug: 'axe', regularItemSlugs: [], neutralItemSlug: null }],
    } as unknown as Board;

    const normalized = normalizeBoard(legacy);
    const slot = normalized.slots[0];
    expect(slot.hasScepter).toBe(false);
    expect(slot.hasShard).toBe(false);
    expect(slot.appliedBuildId).toBeNull();
    expect(slot.regularItemAutocast).toEqual(new Array(REGULAR_ITEM_SLOT_COUNT).fill(false));
    expect(slot.neutralItemAutocast).toBe(false);
    expect(slot.lateGameSwap).toBeNull();
  });

  it('normalizes a partially-shaped lateGameSwap instead of dropping it', () => {
    const legacy = {
      bonusNeutralTier: 5,
      slots: [
        {
          slotId: ROLE_SLOTS[0].id,
          heroSlug: 'axe',
          regularItemSlugs: [],
          neutralItemSlug: null,
          lateGameSwap: { heroSlug: 'sven', regularItemSlugs: ['boots'] },
        },
      ],
    } as unknown as Board;

    const normalized = normalizeBoard(legacy);
    const swap = normalized.slots[0].lateGameSwap;
    expect(swap?.heroSlug).toBe('sven');
    expect(swap?.regularItemSlugs).toHaveLength(REGULAR_ITEM_SLOT_COUNT);
    expect(swap?.regularItemSlugs[0]).toBe('boots');
    expect(swap?.hasScepter).toBe(false);
  });

  it('defaults bonusNeutralTier to 5 unless it was saved as exactly 4', () => {
    const base = { slots: [] as Board['slots'] };
    expect(normalizeBoard({ ...base, bonusNeutralTier: 4 }).bonusNeutralTier).toBe(4);
    expect(normalizeBoard({ ...base, bonusNeutralTier: 5 }).bonusNeutralTier).toBe(5);
    expect(normalizeBoard({ ...base, bonusNeutralTier: undefined } as unknown as Board).bonusNeutralTier).toBe(5);
  });
});

describe('loadActiveBoard / saveActiveBoard', () => {
  it('returns an empty board when nothing is saved', () => {
    expect(loadActiveBoard()).toEqual(emptyBoard());
  });

  it('returns an empty board when the saved value is corrupted JSON', () => {
    localStorage.setItem('dow-planner:active-board', '{not json');
    expect(loadActiveBoard()).toEqual(emptyBoard());
  });

  it('round-trips a saved board through normalization', () => {
    const b = emptyBoard();
    b.slots[0].heroSlug = 'axe';
    saveActiveBoard(b);
    const loaded = loadActiveBoard();
    expect(loaded.slots[0].heroSlug).toBe('axe');
  });
});

describe('loadHeroBuilds', () => {
  it('returns an empty record when nothing is saved and there is no legacy data', () => {
    expect(loadHeroBuilds()).toEqual({});
  });

  it('migrates legacy hero-loadout + agh-flags data into a single Build 1 and clears the legacy keys', () => {
    localStorage.setItem(
      'dow-planner:hero-loadout',
      JSON.stringify({
        axe: {
          regularItemSlugs: ['blink'],
          neutralItemSlug: 'tier1-item',
          situationalItemSlugs: [],
          situationalNeutralItemSlugs: [],
          note: 'my build',
        },
      }),
    );
    localStorage.setItem('dow-planner:hero-agh', JSON.stringify({ axe: { coreScepter: true, coreShard: false } }));

    const builds = loadHeroBuilds();
    expect(builds.axe.builds).toHaveLength(1);
    const build = builds.axe.builds[0];
    expect(build.name).toBe('Build 1');
    expect(build.regularItemSlugs[0]).toBe('blink');
    expect(build.neutralItemSlug).toBe('tier1-item');
    expect(build.hasScepter).toBe(true);
    expect(build.hasShard).toBe(false);
    expect(builds.axe.activeBuildId).toBe(build.id);

    expect(localStorage.getItem('dow-planner:hero-loadout')).toBeNull();
    expect(localStorage.getItem('dow-planner:hero-agh')).toBeNull();
  });

  it('normalizes saved builds and falls back to the first build when activeBuildId is stale', () => {
    saveHeroBuilds({
      axe: {
        activeBuildId: 'missing-id',
        builds: [{ id: 'b1', name: 'Aghs Carry' } as never],
      },
    });
    const builds = loadHeroBuilds();
    expect(builds.axe.activeBuildId).toBe('b1');
    expect(builds.axe.builds[0].regularItemSlugs).toHaveLength(REGULAR_ITEM_SLOT_COUNT);
  });

  it('returns an empty record when the saved value is corrupted JSON', () => {
    localStorage.setItem('dow-planner:hero-builds', '{not json');
    expect(loadHeroBuilds()).toEqual({});
  });
});

describe('hero combo giver toggling', () => {
  it('toggleHeroComboGiver adds then removes a giver for a hero', () => {
    let combos = loadHeroCombos();
    expect(combos).toEqual({});

    combos = toggleHeroComboGiver(combos, 'axe', 'lycan');
    expect(combos.axe).toEqual(['lycan']);

    combos = toggleHeroComboGiver(combos, 'axe', 'lycan');
    expect(combos.axe).toEqual([]);
  });

  it('saveHeroCombos / loadHeroCombos round-trip, ignoring malformed entries', () => {
    saveHeroCombos({ axe: ['lycan'] });
    expect(loadHeroCombos()).toEqual({ axe: ['lycan'] });

    localStorage.setItem('dow-planner:hero-combos', JSON.stringify({ axe: ['lycan'], sven: 'not-an-array' }));
    expect(loadHeroCombos()).toEqual({ axe: ['lycan'] });
  });
});
