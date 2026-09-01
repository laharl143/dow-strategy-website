import { supabase } from './supabase';
import { loadHeroBuilds, saveHeroBuilds, type HeroBuild, type HeroBuildState } from './persistence';

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
}

function toRow(userId: string, heroSlug: string, build: HeroBuild) {
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
    updated_at: new Date().toISOString(),
  };
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

  const { data, error } = await supabase
    .from('hero_loadouts')
    .select(
      'hero_slug, build_id, build_name, regular_item_slugs, neutral_item_slug, situational_item_slugs, situational_neutral_item_slugs, note, has_scepter, has_shard',
    )
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to pull synced hero builds', error);
    return;
  }

  const local = loadHeroBuilds();
  const remoteRows = (data ?? []) as HeroBuildRow[];
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
 * Replaces one hero's synced builds with its current local state — a full
 * delete-then-insert rather than a per-row upsert, so a build removed
 * locally (via the hero page's tab "✕") also disappears remotely. Call
 * whenever a signed-in user's builds for this hero change.
 */
export async function pushHeroBuilds(userId: string, heroSlug: string, state: HeroBuildState): Promise<void> {
  if (!supabase) return;

  const { error: deleteError } = await supabase
    .from('hero_loadouts')
    .delete()
    .eq('user_id', userId)
    .eq('hero_slug', heroSlug);
  if (deleteError) {
    console.error('Failed to sync hero builds', heroSlug, deleteError);
    return;
  }

  if (state.builds.length === 0) return;
  const rows = state.builds.map((build) => toRow(userId, heroSlug, build));
  const { error: insertError } = await supabase.from('hero_loadouts').insert(rows);
  if (insertError) console.error('Failed to sync hero builds', heroSlug, insertError);
}
