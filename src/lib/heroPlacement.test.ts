import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Board, BoardSlot } from '../types';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';
import type { HeroBuildState } from './persistence';

const { loadHeroBuildsMock } = vi.hoisted(() => ({ loadHeroBuildsMock: vi.fn() }));
vi.mock('./persistence', () => ({ loadHeroBuilds: loadHeroBuildsMock }));

// Imported after the mock so placeHeroAt's internal `loadHeroBuilds` call resolves to the mock.
const { placeHeroAt, placeHeroInSlot, placeHeroInLateGameSlot } = await import('./heroPlacement');

function emptySlot(slotId: string, overrides: Partial<BoardSlot> = {}): BoardSlot {
  return {
    slotId,
    heroSlug: null,
    regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
    neutralItemSlug: null,
    hasScepter: false,
    hasShard: false,
    appliedBuildId: null,
    regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
    neutralItemAutocast: false,
    lateGameSwap: null,
    ...overrides,
  };
}

function board(slots: BoardSlot[]): Board {
  return { slots, bonusNeutralTier: 5 };
}

beforeEach(() => {
  loadHeroBuildsMock.mockReset();
  loadHeroBuildsMock.mockReturnValue({});
});

describe('placeHeroAt', () => {
  it('places a brand-new hero with no saved build, leaving the target slot items untouched', () => {
    const b = board([
      emptySlot('a', { regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)] }),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0].heroSlug).toBe('axe');
    expect(next.slots[0].regularItemSlugs[0]).toBe('blink');
  });

  it('seeds a freshly-placed hero from its active saved build', () => {
    const heroBuildState: HeroBuildState = {
      activeBuildId: 'build-1',
      builds: [
        {
          id: 'build-1',
          name: 'Build 1',
          regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
          neutralItemSlug: 'tier1-item',
          situationalItemSlugs: [],
          situationalNeutralItemSlugs: [],
          note: '',
          hasScepter: true,
          hasShard: false,
          regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
          neutralItemAutocast: false,
        },
      ],
    };
    loadHeroBuildsMock.mockReturnValue({ axe: heroBuildState });

    const b = board([emptySlot('a')]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0].regularItemSlugs[0]).toBe('blink');
    expect(next.slots[0].neutralItemSlug).toBe('tier1-item');
    expect(next.slots[0].appliedBuildId).toBe('build-1');
    expect(next.slots[0].hasScepter).toBe(true);
  });

  it('does not seed from a saved build that has no items at all', () => {
    const heroBuildState: HeroBuildState = {
      activeBuildId: 'build-1',
      builds: [
        {
          id: 'build-1',
          name: 'Build 1',
          regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
          neutralItemSlug: null,
          situationalItemSlugs: [],
          situationalNeutralItemSlugs: [],
          note: '',
          hasScepter: false,
          hasShard: false,
          regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
          neutralItemAutocast: false,
        },
      ],
    };
    loadHeroBuildsMock.mockReturnValue({ axe: heroBuildState });

    const b = board([
      emptySlot('a', { regularItemSlugs: ['boots', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)] }),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0].regularItemSlugs[0]).toBe('boots');
    expect(next.slots[0].appliedBuildId).toBeNull();
  });

  it('is a no-op when the hero is already at the exact target', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next).toBe(b);
  });

  it('swaps two heroes (and their full loadouts) when placing onto an occupied primary slot', () => {
    const b = board([
      emptySlot('a', {
        heroSlug: 'axe',
        regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
      }),
      emptySlot('b', {
        heroSlug: 'sven',
        regularItemSlugs: ['boots', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
      }),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'b' }, 'axe');
    expect(next.slots[0]).toMatchObject({ heroSlug: 'sven', regularItemSlugs: expect.arrayContaining(['boots']) });
    expect(next.slots[1]).toMatchObject({ heroSlug: 'axe', regularItemSlugs: expect.arrayContaining(['blink']) });
  });

  it('swaps a primary hero with a late-game swap hero', () => {
    const b: Board = {
      bonusNeutralTier: 5,
      slots: [
        emptySlot('a', { heroSlug: 'axe' }),
        emptySlot('b', {
          lateGameSwap: {
            heroSlug: 'sven',
            regularItemSlugs: ['boots', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
            neutralItemSlug: null,
            hasScepter: false,
            hasShard: false,
            appliedBuildId: null,
            regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
            neutralItemAutocast: false,
          },
        }),
      ],
    };
    const next = placeHeroAt(b, { kind: 'lategame', slotId: 'b' }, 'axe');
    // axe's old (primary) slot now holds whatever the late-game target held — sven, with his items.
    expect(next.slots[0].heroSlug).toBe('sven');
    expect(next.slots[0].regularItemSlugs[0]).toBe('boots');
    // the late-game slot now holds axe, with axe's old (empty) loadout.
    expect(next.slots[1].lateGameSwap?.heroSlug).toBe('axe');
    expect(next.slots[1].lateGameSwap?.regularItemSlugs[0]).toBeNull();
  });

  it('displaces the occupant (with its full loadout) to the first open slot when placing an unplaced hero onto an occupied primary slot', () => {
    const b = board([
      emptySlot('a', {
        heroSlug: 'sven',
        regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
        neutralItemSlug: 'tier1-item',
        hasScepter: true,
      }),
      emptySlot('b'),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0]).toMatchObject({ heroSlug: 'axe', regularItemSlugs: [null, null, null, null, null, null, null, null, null] });
    expect(next.slots[1]).toMatchObject({
      heroSlug: 'sven',
      regularItemSlugs: expect.arrayContaining(['blink']),
      neutralItemSlug: 'tier1-item',
      hasScepter: true,
    });
  });

  it('does not mislabel the displaced occupant\'s items as the incoming hero\'s when the incoming hero has no saved build', () => {
    const b = board([
      emptySlot('a', { heroSlug: 'sven', regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)] }),
      emptySlot('b'),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    // axe (freshly placed, no saved build) must not inherit sven's leftover items.
    expect(next.slots[0].regularItemSlugs.every((s) => s === null)).toBe(true);
    // sven keeps them, relocated to the open slot.
    expect(next.slots[1].regularItemSlugs[0]).toBe('blink');
  });

  it('seeds the incoming hero from its saved build when displacing an occupant', () => {
    const heroBuildState: HeroBuildState = {
      activeBuildId: 'build-1',
      builds: [
        {
          id: 'build-1',
          name: 'Build 1',
          regularItemSlugs: ['boots', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
          neutralItemSlug: null,
          situationalItemSlugs: [],
          situationalNeutralItemSlugs: [],
          note: '',
          hasScepter: false,
          hasShard: false,
          regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
          neutralItemAutocast: false,
        },
      ],
    };
    loadHeroBuildsMock.mockReturnValue({ axe: heroBuildState });

    const b = board([
      emptySlot('a', { heroSlug: 'sven', regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)] }),
      emptySlot('b'),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0]).toMatchObject({ heroSlug: 'axe', regularItemSlugs: expect.arrayContaining(['boots']) });
    expect(next.slots[1]).toMatchObject({ heroSlug: 'sven', regularItemSlugs: expect.arrayContaining(['blink']) });
  });

  it('falls back to overwriting the occupant in place when the entire board is full (no open slot to displace it to)', () => {
    const b = board([
      emptySlot('a', { heroSlug: 'sven', regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)] }),
      emptySlot('b', { heroSlug: 'pudge' }),
    ]);
    const next = placeHeroAt(b, { kind: 'primary', slotId: 'a' }, 'axe');
    expect(next.slots[0].heroSlug).toBe('axe');
    expect(next.slots[1].heroSlug).toBe('pudge');
  });

  it('placeHeroInSlot and placeHeroInLateGameSlot address the right target kind', () => {
    const b = board([emptySlot('a')]);
    expect(placeHeroInSlot(b, 'a', 'axe').slots[0].heroSlug).toBe('axe');

    const withSwap: Board = {
      ...b,
      slots: [
        {
          ...b.slots[0],
          lateGameSwap: {
            heroSlug: null,
            regularItemSlugs: new Array(REGULAR_ITEM_SLOT_COUNT).fill(null),
            neutralItemSlug: null,
            hasScepter: false,
            hasShard: false,
            appliedBuildId: null,
            regularItemAutocast: new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
            neutralItemAutocast: false,
          },
        },
      ],
    };
    expect(placeHeroInLateGameSlot(withSwap, 'a', 'sven').slots[0].lateGameSwap?.heroSlug).toBe('sven');
  });
});
