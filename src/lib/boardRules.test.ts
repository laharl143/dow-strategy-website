import { describe, it, expect } from 'vitest';
import type { Board, BoardSlot, NeutralItem } from '../types';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';
import {
  neutralTierDuplicateGroups,
  setHero,
  setRegularItem,
  setNeutralItem,
  applyHeroBuild,
  toggleRegularItemAutocast,
  toggleNeutralItemAutocast,
  toggleScepter,
  toggleShard,
  addLateGameSwap,
  removeLateGameSwap,
  clearLateGameHero,
  emptyLateGameSwap,
} from './boardRules';
import type { HeroBuild } from './persistence';

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

function board(slots: BoardSlot[], bonusNeutralTier: 4 | 5 = 5): Board {
  return { slots, bonusNeutralTier };
}

const neutralItemBySlug = new Map<string, NeutralItem>([
  ['tier1-item', { slug: 'tier1-item', name: 'Tier 1', iconUrl: null, tier: 1 }],
  ['tier5-item', { slug: 'tier5-item', name: 'Tier 5', iconUrl: null, tier: 5 }],
]);

describe('neutralTierDuplicateGroups', () => {
  it('returns nothing when no tier has more slots than its cap', () => {
    const b = board([
      emptySlot('a', { heroSlug: 'axe', neutralItemSlug: 'tier1-item' }),
      emptySlot('b', { heroSlug: 'sven' }),
    ]);
    expect(neutralTierDuplicateGroups(b, neutralItemBySlug).size).toBe(0);
  });

  it('flags a normal tier once more than one hero holds it (cap 1)', () => {
    const b = board([
      emptySlot('a', { heroSlug: 'axe', neutralItemSlug: 'tier1-item' }),
      emptySlot('b', { heroSlug: 'sven', neutralItemSlug: 'tier1-item' }),
    ]);
    const groups = neutralTierDuplicateGroups(b, neutralItemBySlug);
    expect(groups.get(1)).toEqual(['axe', 'sven']);
  });

  it('does not flag the bonus tier when exactly 2 heroes hold it (cap 2)', () => {
    const b = board(
      [
        emptySlot('a', { heroSlug: 'axe', neutralItemSlug: 'tier5-item' }),
        emptySlot('b', { heroSlug: 'sven', neutralItemSlug: 'tier5-item' }),
      ],
      5,
    );
    expect(neutralTierDuplicateGroups(b, neutralItemBySlug).size).toBe(0);
  });

  it('flags the bonus tier once a third hero holds it (still capped at 2)', () => {
    const b = board(
      [
        emptySlot('a', { heroSlug: 'axe', neutralItemSlug: 'tier5-item' }),
        emptySlot('b', { heroSlug: 'sven', neutralItemSlug: 'tier5-item' }),
        emptySlot('c', { heroSlug: 'lina', neutralItemSlug: 'tier5-item' }),
      ],
      5,
    );
    const groups = neutralTierDuplicateGroups(b, neutralItemBySlug);
    expect(groups.get(5)).toEqual(['axe', 'sven', 'lina']);
  });

  it('ignores late-game swap slots and empty slots', () => {
    const b = board([
      emptySlot('a', {
        heroSlug: null,
        neutralItemSlug: null,
        lateGameSwap: { ...emptyLateGameSwap(), heroSlug: 'sven', neutralItemSlug: 'tier1-item' },
      }),
      emptySlot('b', { heroSlug: 'axe', neutralItemSlug: 'tier1-item' }),
    ]);
    expect(neutralTierDuplicateGroups(b, neutralItemBySlug).size).toBe(0);
  });
});

describe('setHero', () => {
  it('clearing a hero wipes its items and agh flags', () => {
    const b = board([
      emptySlot('a', {
        heroSlug: 'axe',
        regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
        neutralItemSlug: 'tier1-item',
        hasScepter: true,
        hasShard: true,
      }),
    ]);
    const next = setHero(b, 'a', null);
    const slot = next.slots[0];
    expect(slot.heroSlug).toBeNull();
    expect(slot.regularItemSlugs).toEqual(new Array(REGULAR_ITEM_SLOT_COUNT).fill(null));
    expect(slot.neutralItemSlug).toBeNull();
    expect(slot.hasScepter).toBe(false);
    expect(slot.hasShard).toBe(false);
  });

  it('placing a hero without a seed leaves existing items untouched', () => {
    const b = board([
      emptySlot('a', {
        regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
      }),
    ]);
    const next = setHero(b, 'a', 'axe');
    expect(next.slots[0].heroSlug).toBe('axe');
    expect(next.slots[0].regularItemSlugs[0]).toBe('blink');
  });

  it('placing a hero with a seed overwrites items and neutral item from the seed', () => {
    const b = board([emptySlot('a')]);
    const seed = {
      regularItemSlugs: ['blink', ...new Array(REGULAR_ITEM_SLOT_COUNT - 1).fill(null)],
      neutralItemSlug: 'tier1-item',
    };
    const next = setHero(b, 'a', 'axe', seed);
    expect(next.slots[0].regularItemSlugs[0]).toBe('blink');
    expect(next.slots[0].neutralItemSlug).toBe('tier1-item');
  });
});

describe('primary/late-game shared mutators (HeroTarget)', () => {
  it('setRegularItem writes to a primary slot', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    const next = setRegularItem(b, { kind: 'primary', slotId: 'a' }, 0, 'blink');
    expect(next.slots[0].regularItemSlugs[0]).toBe('blink');
  });

  it('setRegularItem writes to an existing late-game swap slot', () => {
    const b = board([addLateGameSwap(board([emptySlot('a')]), 'a').slots[0]]);
    const withHero = { ...b, slots: [{ ...b.slots[0], lateGameSwap: { ...b.slots[0].lateGameSwap!, heroSlug: 'sven' } }] };
    const next = setRegularItem(withHero, { kind: 'lategame', slotId: 'a' }, 2, 'boots');
    expect(next.slots[0].lateGameSwap?.regularItemSlugs[2]).toBe('boots');
  });

  it('setRegularItem is a no-op on a late-game target with no swap card', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    const next = setRegularItem(b, { kind: 'lategame', slotId: 'a' }, 0, 'blink');
    expect(next).toEqual(b);
  });

  it('setNeutralItem writes to the target loadout', () => {
    const withSwap = addLateGameSwap(board([emptySlot('a', { heroSlug: 'axe' })]), 'a');
    const next = setNeutralItem(withSwap, { kind: 'primary', slotId: 'a' }, 'tier1-item');
    expect(next.slots[0].neutralItemSlug).toBe('tier1-item');
  });

  it('toggleRegularItemAutocast flips only the given index', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    const next = toggleRegularItemAutocast(b, { kind: 'primary', slotId: 'a' }, 3);
    expect(next.slots[0].regularItemAutocast[3]).toBe(true);
    expect(next.slots[0].regularItemAutocast[2]).toBe(false);
  });

  it('toggleNeutralItemAutocast flips the flag', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    const next = toggleNeutralItemAutocast(b, { kind: 'primary', slotId: 'a' });
    expect(next.slots[0].neutralItemAutocast).toBe(true);
  });

  it('toggleScepter/toggleShard are no-ops without a hero on the target', () => {
    const b = board([emptySlot('a')]);
    expect(toggleScepter(b, { kind: 'primary', slotId: 'a' })).toEqual(b);
    expect(toggleShard(b, { kind: 'primary', slotId: 'a' })).toEqual(b);
  });

  it('toggleScepter/toggleShard flip when a hero is present', () => {
    const b = board([emptySlot('a', { heroSlug: 'axe' })]);
    expect(toggleScepter(b, { kind: 'primary', slotId: 'a' }).slots[0].hasScepter).toBe(true);
    expect(toggleShard(b, { kind: 'primary', slotId: 'a' }).slots[0].hasShard).toBe(true);
  });

  it('applyHeroBuild overwrites items/agh flags from a saved build for both primary and late-game targets', () => {
    const build: HeroBuild = {
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
    };

    const primaryBoard = board([emptySlot('a', { heroSlug: 'axe' })]);
    const primaryNext = applyHeroBuild(primaryBoard, { kind: 'primary', slotId: 'a' }, build);
    expect(primaryNext.slots[0].regularItemSlugs[0]).toBe('blink');
    expect(primaryNext.slots[0].appliedBuildId).toBe('build-1');
    expect(primaryNext.slots[0].hasScepter).toBe(true);

    const swapBoard = addLateGameSwap(board([emptySlot('b')]), 'b');
    const lategameNext = applyHeroBuild(swapBoard, { kind: 'lategame', slotId: 'b' }, build);
    expect(lategameNext.slots[0].lateGameSwap?.regularItemSlugs[0]).toBe('blink');
    expect(lategameNext.slots[0].lateGameSwap?.appliedBuildId).toBe('build-1');
  });
});

describe('late-game swap lifecycle', () => {
  it('addLateGameSwap creates an empty swap card', () => {
    const b = board([emptySlot('a')]);
    const next = addLateGameSwap(b, 'a');
    expect(next.slots[0].lateGameSwap).toEqual(emptyLateGameSwap());
  });

  it('removeLateGameSwap removes the card entirely', () => {
    const b = addLateGameSwap(board([emptySlot('a')]), 'a');
    const next = removeLateGameSwap(b, 'a');
    expect(next.slots[0].lateGameSwap).toBeNull();
  });

  it('clearLateGameHero resets the card contents but keeps the card', () => {
    const withSwap = addLateGameSwap(board([emptySlot('a')]), 'a');
    const withHero = {
      ...withSwap,
      slots: [{ ...withSwap.slots[0], lateGameSwap: { ...withSwap.slots[0].lateGameSwap!, heroSlug: 'sven' } }],
    };
    const next = clearLateGameHero(withHero, 'a');
    expect(next.slots[0].lateGameSwap).toEqual(emptyLateGameSwap());
  });

  it('clearLateGameHero is a no-op when there is no swap card', () => {
    const b = board([emptySlot('a')]);
    expect(clearLateGameHero(b, 'a')).toEqual(b);
  });
});
