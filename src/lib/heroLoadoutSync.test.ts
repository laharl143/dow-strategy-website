import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HeroBuildState } from './persistence';

type PendingOp = 'probeSchema' | 'probeAutocast' | 'pull' | 'upsert' | 'delete' | null;

interface SupabaseMockOptions {
  schemaError?: unknown;
  autocastError?: unknown;
  pullData?: unknown[];
  pullError?: unknown;
  upsertError?: unknown;
  deleteError?: unknown;
}

/**
 * A minimal fake of the chained supabase-js query builder, covering exactly
 * the call shapes heroLoadoutSync.ts makes: .select('build_id')/.limit(1) and
 * .select('regular_item_autocast')/.limit(1) for the two schema probes,
 * .select(<columns>).eq(...) for the pull, and .upsert(...) / .delete().eq
 * ().eq().not(...) for the push. Every chain method returns the same object
 * so calls can be composed in any order; the pending "kind" of operation is
 * tracked so the final `await` resolves with the right canned result.
 */
function createSupabaseMock(opts: SupabaseMockOptions) {
  let pendingOp: PendingOp = null;
  const resultFor = (op: PendingOp) => {
    switch (op) {
      case 'probeSchema':
        return { error: opts.schemaError ?? null };
      case 'probeAutocast':
        return { error: opts.autocastError ?? null };
      case 'pull':
        return { data: opts.pullData ?? [], error: opts.pullError ?? null };
      case 'upsert':
        return { error: opts.upsertError ?? null };
      case 'delete':
        return { error: opts.deleteError ?? null };
      default:
        return { error: null };
    }
  };
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn((cols: string) => {
      pendingOp = cols === 'build_id' ? 'probeSchema' : cols === 'regular_item_autocast' ? 'probeAutocast' : 'pull';
      return chain;
    }),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    upsert: vi.fn(() => {
      pendingOp = 'upsert';
      return chain;
    }),
    delete: vi.fn(() => {
      pendingOp = 'delete';
      return chain;
    }),
    not: vi.fn(() => chain),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resultFor(pendingOp)).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

async function loadModule(
  supabaseMock: ReturnType<typeof createSupabaseMock> | null,
  persistenceMocks: {
    loadHeroBuilds?: () => Record<string, HeroBuildState>;
    saveHeroBuilds?: (v: unknown) => void;
    loadHeroCombos?: () => Record<string, string[]>;
    saveHeroCombos?: (v: unknown) => void;
  },
) {
  vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
  vi.doMock('./persistence', () => ({
    loadHeroBuilds: persistenceMocks.loadHeroBuilds ?? vi.fn(() => ({})),
    saveHeroBuilds: persistenceMocks.saveHeroBuilds ?? vi.fn(),
    loadHeroCombos: persistenceMocks.loadHeroCombos ?? vi.fn(() => ({})),
    saveHeroCombos: persistenceMocks.saveHeroCombos ?? vi.fn(),
  }));
  return import('./heroLoadoutSync');
}

type ComboPendingOp = 'probeSchema' | 'pull' | 'upsert' | 'delete' | null;

interface ComboSupabaseMockOptions {
  schemaError?: unknown;
  pullData?: unknown[];
  pullError?: unknown;
  upsertError?: unknown;
  deleteError?: unknown;
}

/**
 * A minimal fake of the chained supabase-js query builder, covering exactly
 * the call shapes heroLoadoutSync.ts's Combo sync makes: .select('hero_slug')
 * /.limit(1) for the schema probe, .select('hero_slug, giver_slugs').eq(...)
 * for the pull, and .upsert(...) / .delete().eq().eq() for the push.
 */
function createComboSupabaseMock(opts: ComboSupabaseMockOptions) {
  let pendingOp: ComboPendingOp = null;
  const resultFor = (op: ComboPendingOp) => {
    switch (op) {
      case 'probeSchema':
        return { error: opts.schemaError ?? null };
      case 'pull':
        return { data: opts.pullData ?? [], error: opts.pullError ?? null };
      case 'upsert':
        return { error: opts.upsertError ?? null };
      case 'delete':
        return { error: opts.deleteError ?? null };
      default:
        return { error: null };
    }
  };
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn((cols: string) => {
      pendingOp = cols === 'hero_slug' ? 'probeSchema' : 'pull';
      return chain;
    }),
    limit: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    upsert: vi.fn(() => {
      pendingOp = 'upsert';
      return chain;
    }),
    delete: vi.fn(() => {
      pendingOp = 'delete';
      return chain;
    }),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resultFor(pendingOp)).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

beforeEach(() => {
  vi.resetModules();
});

describe('pullAndMergeHeroBuilds', () => {
  it('merges remote and local builds per build id: remote wins on shared ids, local-only ids survive (DOW-38)', async () => {
    const local: Record<string, HeroBuildState> = {
      axe: {
        activeBuildId: 'b1',
        builds: [
          {
            id: 'b1',
            name: 'Local Only',
            regularItemSlugs: new Array(9).fill(null),
            neutralItemSlug: null,
            situationalItemSlugs: [],
            situationalNeutralItemSlugs: [],
            note: '',
            hasScepter: false,
            hasShard: false,
            regularItemAutocast: new Array(9).fill(false),
            neutralItemAutocast: false,
          },
          {
            id: 'b2',
            name: 'Stale Local Copy',
            regularItemSlugs: new Array(9).fill(null),
            neutralItemSlug: null,
            situationalItemSlugs: [],
            situationalNeutralItemSlugs: [],
            note: '',
            hasScepter: false,
            hasShard: false,
            regularItemAutocast: new Array(9).fill(false),
            neutralItemAutocast: false,
          },
        ],
      },
    };
    const remoteRows = [
      {
        hero_slug: 'axe',
        build_id: 'b2',
        build_name: 'New Name From Remote',
        regular_item_slugs: new Array(9).fill(null),
        neutral_item_slug: null,
        situational_item_slugs: [],
        situational_neutral_item_slugs: [],
        note: '',
        has_scepter: false,
        has_shard: false,
        regular_item_autocast: new Array(9).fill(false),
        neutral_item_autocast: false,
      },
      {
        hero_slug: 'axe',
        build_id: 'b3',
        build_name: 'Brand New From Remote',
        regular_item_slugs: new Array(9).fill(null),
        neutral_item_slug: null,
        situational_item_slugs: [],
        situational_neutral_item_slugs: [],
        note: '',
        has_scepter: false,
        has_shard: false,
        regular_item_autocast: new Array(9).fill(false),
        neutral_item_autocast: false,
      },
    ];

    const supabaseMock = createSupabaseMock({ pullData: remoteRows });
    const saveHeroBuilds = vi.fn();
    const { pullAndMergeHeroBuilds } = await loadModule(supabaseMock, {
      loadHeroBuilds: () => local,
      saveHeroBuilds,
    });

    await pullAndMergeHeroBuilds('user-1');

    expect(saveHeroBuilds).toHaveBeenCalledTimes(1);
    const merged = saveHeroBuilds.mock.calls[0][0] as Record<string, HeroBuildState>;
    const ids = merged.axe.builds.map((b) => b.id);
    expect(ids).toContain('b1');
    expect(ids).toContain('b2');
    expect(ids).toContain('b3');
    expect(merged.axe.builds.find((b) => b.id === 'b2')?.name).toBe('New Name From Remote');
    expect(merged.axe.builds.find((b) => b.id === 'b1')?.name).toBe('Local Only');
    // previously-active local-only build id is preserved rather than reset.
    expect(merged.axe.activeBuildId).toBe('b1');

    // Every touched hero gets re-pushed so surviving local-only builds reach Supabase.
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it('no-ops without touching local data when the schema probe fails on an unmigrated table (DOW-26)', async () => {
    const supabaseMock = createSupabaseMock({ schemaError: { message: 'relation "hero_loadouts" does not exist' } });
    const saveHeroBuilds = vi.fn();
    const { pullAndMergeHeroBuilds } = await loadModule(supabaseMock, { saveHeroBuilds });

    await pullAndMergeHeroBuilds('user-1');

    expect(saveHeroBuilds).not.toHaveBeenCalled();
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when supabase is not configured', async () => {
    const saveHeroBuilds = vi.fn();
    const { pullAndMergeHeroBuilds } = await loadModule(null, { saveHeroBuilds });

    await expect(pullAndMergeHeroBuilds('user-1')).resolves.toBeUndefined();
    expect(saveHeroBuilds).not.toHaveBeenCalled();
  });
});

describe('pushHeroBuilds', () => {
  it('no-ops (never calls upsert) when the schema probe fails on an unmigrated table', async () => {
    const supabaseMock = createSupabaseMock({ schemaError: { message: 'relation missing' } });
    const { pushHeroBuilds } = await loadModule(supabaseMock, {});

    const state: HeroBuildState = {
      activeBuildId: 'b1',
      builds: [
        {
          id: 'b1',
          name: 'Build 1',
          regularItemSlugs: new Array(9).fill(null),
          neutralItemSlug: null,
          situationalItemSlugs: [],
          situationalNeutralItemSlugs: [],
          note: '',
          hasScepter: false,
          hasShard: false,
          regularItemAutocast: new Array(9).fill(false),
          neutralItemAutocast: false,
        },
      ],
    };

    await pushHeroBuilds('user-1', 'axe', state);

    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it('does nothing for a hero with no builds', async () => {
    const supabaseMock = createSupabaseMock({});
    const { pushHeroBuilds } = await loadModule(supabaseMock, {});

    await pushHeroBuilds('user-1', 'axe', { activeBuildId: '', builds: [] });

    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });
});

// DOW-57: before this fix, Hero Combo giver assignments had no sync path at
// all — pullAndMergeHeroCombos/pushHeroCombos didn't exist, so
// clearAccountScopedLocalData()'s sign-out cleanup had nothing to restore
// them from. These tests demonstrate the sync now round-trips combos the
// same way hero builds already do.
describe('pullAndMergeHeroCombos', () => {
  it('merges remote and local combos per hero: remote wins on shared heroes, local-only heroes survive', async () => {
    const local: Record<string, string[]> = {
      axe: ['lycan'], // shared with remote below — remote's value should win
      pudge: ['io'], // local-only — never made it to Supabase, must survive the merge
    };
    const remoteRows = [{ hero_slug: 'axe', giver_slugs: ['lycan', 'snapfire'] }];

    const supabaseMock = createComboSupabaseMock({ pullData: remoteRows });
    const saveHeroCombos = vi.fn();
    vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: () => local,
      saveHeroCombos,
    }));
    const { pullAndMergeHeroCombos } = await import('./heroLoadoutSync');

    await pullAndMergeHeroCombos('user-1');

    expect(saveHeroCombos).toHaveBeenCalledTimes(1);
    const merged = saveHeroCombos.mock.calls[0][0] as Record<string, string[]>;
    expect(merged.axe).toEqual(['lycan', 'snapfire']);
    expect(merged.pudge).toEqual(['io']);

    // Every touched hero gets re-pushed so the surviving local-only combo reaches Supabase.
    expect(supabaseMock.upsert).toHaveBeenCalled();
  });

  it('no-ops without touching local data when the schema probe fails on an unmigrated table', async () => {
    const supabaseMock = createComboSupabaseMock({ schemaError: { message: 'relation "hero_combos" does not exist' } });
    vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
    const saveHeroCombos = vi.fn();
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: vi.fn(() => ({})),
      saveHeroCombos,
    }));
    const { pullAndMergeHeroCombos } = await import('./heroLoadoutSync');

    await pullAndMergeHeroCombos('user-1');

    expect(saveHeroCombos).not.toHaveBeenCalled();
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when supabase is not configured', async () => {
    vi.doMock('./supabase', () => ({ supabase: null }));
    const saveHeroCombos = vi.fn();
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: vi.fn(() => ({})),
      saveHeroCombos,
    }));
    const { pullAndMergeHeroCombos } = await import('./heroLoadoutSync');

    await expect(pullAndMergeHeroCombos('user-1')).resolves.toBeUndefined();
    expect(saveHeroCombos).not.toHaveBeenCalled();
  });
});

describe('pushHeroCombos', () => {
  it('no-ops (never calls upsert) when the schema probe fails on an unmigrated table', async () => {
    const supabaseMock = createComboSupabaseMock({ schemaError: { message: 'relation missing' } });
    vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: vi.fn(() => ({})),
      saveHeroCombos: vi.fn(),
    }));
    const { pushHeroCombos } = await import('./heroLoadoutSync');

    await pushHeroCombos('user-1', 'axe', ['lycan']);

    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });

  it('upserts a non-empty giver list', async () => {
    const supabaseMock = createComboSupabaseMock({});
    vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: vi.fn(() => ({})),
      saveHeroCombos: vi.fn(),
    }));
    const { pushHeroCombos } = await import('./heroLoadoutSync');

    await pushHeroCombos('user-1', 'axe', ['lycan']);

    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', hero_slug: 'axe', giver_slugs: ['lycan'] }),
      { onConflict: 'user_id,hero_slug' },
    );
    expect(supabaseMock.delete).not.toHaveBeenCalled();
  });

  it('deletes the row instead of upserting once the giver list is emptied', async () => {
    const supabaseMock = createComboSupabaseMock({});
    vi.doMock('./supabase', () => ({ supabase: supabaseMock }));
    vi.doMock('./persistence', () => ({
      loadHeroBuilds: vi.fn(() => ({})),
      saveHeroBuilds: vi.fn(),
      loadHeroCombos: vi.fn(() => ({})),
      saveHeroCombos: vi.fn(),
    }));
    const { pushHeroCombos } = await import('./heroLoadoutSync');

    await pushHeroCombos('user-1', 'axe', []);

    expect(supabaseMock.delete).toHaveBeenCalled();
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
  });
});
