import { supabase } from './supabase';
import { loadHeroBuilds, saveHeroBuilds, type HeroBuild, type HeroBuildState } from './persistence';
import { REGULAR_ITEM_SLOT_COUNT } from './boardRules';

interface HeroBuildRow {
  hero_slug: string;
  build_id: string;
  build_name: string;
  regular_item_slugs: (string | null)[];
  neutral_item_slug: string | null;
  situational_item_slugs: (string | null)[] | null;
  situational_neutral_item_slugs: (string | null)[] | null;
  note: string | null;
  has_scepter: boolean | null;
  has_shard: boolean | null;
  regular_item_autocast: boolean[] | null;
  neutral_item_autocast: boolean | null;
}

function toRow(userId: string, heroSlug: string, build: HeroBuild, includeAutocast: boolean) {
  return {
    user_id: userId,
    hero_slug: heroSlug,
    build_id: build.id,
    build_name: build.name,
    regular_item_slugs: build.regularItemSlugs,
    neutral_item_slug: build.neutralItemSlug,
    situational_item_slugs: build.situationalItemSlugs,
    situational_neutral_item_slugs: build.situationalNeutralItemSlugs,
    note: build.note,
    has_scepter: build.hasScepter,
    has_shard: build.hasShard,
    ...(includeAutocast
      ? { regular_item_autocast: build.regularItemAutocast, neutral_item_autocast: build.neutralItemAutocast }
      : null),
    updated_at: new Date().toISOString(),
  };
}

// Probes for the multi-build columns (added by the updated supabase/schema.sql)
// before doing anything else. Until that migration has actually been run
// against this Supabase project, pull/push both no-op instead of touching
// the table — a prior version of this file deleted a hero's row before
// inserting its replacement, and on an unmigrated table the insert failed
// silently (unknown columns) while the delete had already gone through,
// destroying saved builds. Cached for the page's lifetime: schema state
// doesn't change without a deploy, so there's no need to re-probe per call.
let schemaReadyCheck: Promise<boolean> | null = null;

async function probeSchemaReady(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hero_loadouts').select('build_id').limit(1);
  return !error;
}

function isSchemaReady(): Promise<boolean> {
  if (!schemaReadyCheck) schemaReadyCheck = probeSchemaReady();
  return schemaReadyCheck;
}

// Whether the later DOW-9 autocast migration has actually been run — probed
// separately (and more leniently than isSchemaReady above) so a project that
// has the base multi-build columns but hasn't picked up the autocast ones
// yet still gets everything else pulled/pushed, instead of the select below
// failing outright on the missing columns and silently discarding every
// saved build (this is exactly what was happening: the base schema was
// migrated, the autocast columns weren't, and pulls were failing whole-hog
// on "column regular_item_autocast does not exist" with nothing surfaced
// beyond a console.error, so a hero's saved Core Items — including its
// neutral item — never made it into this browser at all).
let autocastColumnsReadyCheck: Promise<boolean> | null = null;

async function probeAutocastColumnsReady(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hero_loadouts').select('regular_item_autocast').limit(1);
  return !error;
}

function areAutocastColumnsReady(): Promise<boolean> {
  if (!autocastColumnsReadyCheck) autocastColumnsReadyCheck = probeAutocastColumnsReady();
  return autocastColumnsReadyCheck;
}

/**
 * Called once when a user signs in. Pulls their synced builds down, merges
 * them with whatever's already in this browser's localStorage (remote wins
 * per-hero when both exist, since the whole point is "the most recent thing
 * I set on another machine"), writes the merged result back to localStorage,
 * and pushes any local-only hero builds (never synced before) up to Supabase.
 */
export async function pullAndMergeHeroBuilds(userId: string): Promise<void> {
  if (!supabase) return;
  if (!(await isSchemaReady())) {
    console.warn('hero_loadouts is missing the multi-build columns — run supabase/schema.sql. Sync skipped.');
    return;
  }

  const autocastReady = await areAutocastColumnsReady();
  const baseColumns =
    'hero_slug, build_id, build_name, regular_item_slugs, neutral_item_slug, situational_item_slugs, situational_neutral_item_slugs, note, has_scepter, has_shard';
  const columns: string = autocastReady ? `${baseColumns}, regular_item_autocast, neutral_item_autocast` : baseColumns;

  const { data, error } = await supabase.from('hero_loadouts').select(columns).eq('user_id', userId);

  if (error) {
    console.error('Failed to pull synced hero builds', error);
    return;
  }
  if (!autocastReady) {
    console.warn(
      'hero_loadouts is missing the autocast columns — run supabase/schema.sql. Builds synced without autocast flags.',
    );
  }

  const local = loadHeroBuilds();
  const remoteRows = (data ?? []) as unknown as HeroBuildRow[];
  const remoteByHero = new Map<string, HeroBuildRow[]>();
  for (const row of remoteRows) {
    const list = remoteByHero.get(row.hero_slug) ?? [];
    list.push(row);
    remoteByHero.set(row.hero_slug, list);
  }

  const merged: Record<string, HeroBuildState> = { ...local };
  for (const [heroSlug, rows] of remoteByHero) {
    const builds: HeroBuild[] = rows.map((r) => ({
      id: r.build_id,
      name: r.build_name,
      regularItemSlugs: r.regular_item_slugs,
      neutralItemSlug: r.neutral_item_slug,
      situationalItemSlugs: r.situational_item_slugs ?? [],
      situationalNeutralItemSlugs: r.situational_neutral_item_slugs ?? [],
      note: r.note ?? '',
      hasScepter: r.has_scepter ?? false,
      hasShard: r.has_shard ?? false,
      regularItemAutocast: r.regular_item_autocast ?? new Array(REGULAR_ITEM_SLOT_COUNT).fill(false),
      neutralItemAutocast: r.neutral_item_autocast ?? false,
    }));
    merged[heroSlug] = { builds, activeBuildId: builds[0]?.id ?? '' };
  }
  saveHeroBuilds(merged);

  const localOnly = Object.entries(local).filter(([slug]) => !remoteByHero.has(slug));
  for (const [heroSlug, state] of localOnly) {
    await pushHeroBuilds(userId, heroSlug, state);
  }
}

/**
 * Syncs one hero's builds to Supabase: upserts every current build first
 * (keyed on user_id/hero_slug/build_id), then — only once that succeeds —
 * deletes any remote rows for builds no longer present locally (i.e. ones
 * removed via the hero page's tab "✕"). Never deletes before the write
 * that's meant to replace it has actually landed. No-ops entirely until
 * the multi-build schema migration has been run (see isSchemaReady above).
 */
export async function pushHeroBuilds(userId: string, heroSlug: string, state: HeroBuildState): Promise<void> {
  if (!supabase) return;
  if (!(await isSchemaReady())) {
    console.warn('hero_loadouts is missing the multi-build columns — run supabase/schema.sql. Sync skipped.');
    return;
  }
  if (state.builds.length === 0) return;

  const autocastReady = await areAutocastColumnsReady();
  const rows = state.builds.map((build) => toRow(userId, heroSlug, build, autocastReady));
  const { error: upsertError } = await supabase
    .from('hero_loadouts')
    .upsert(rows, { onConflict: 'user_id,hero_slug,build_id' });
  if (upsertError) {
    console.error('Failed to sync hero builds', heroSlug, upsertError);
    return;
  }

  const keepIds = state.builds.map((b) => `"${b.id}"`).join(',');
  const { error: deleteError } = await supabase
    .from('hero_loadouts')
    .delete()
    .eq('user_id', userId)
    .eq('hero_slug', heroSlug)
    .not('build_id', 'in', `(${keepIds})`);
  if (deleteError) console.error('Failed to prune removed hero builds', heroSlug, deleteError);
}
