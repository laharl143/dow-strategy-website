import { supabase } from './supabase';
import { loadHeroItemLoadouts, saveHeroItemLoadouts, type HeroItemLoadout } from './persistence';

interface HeroLoadoutRow {
  hero_slug: string;
  regular_item_slugs: (string | null)[];
  neutral_item_slug: string | null;
  situational_item_slugs: (string | null)[] | null;
  situational_neutral_item_slugs: (string | null)[] | null;
  note: string | null;
}

/**
 * Called once when a user signs in. Pulls their synced builds down, merges
 * them with whatever's already in this browser's localStorage (remote wins
 * per-hero when both exist, since the whole point is "the most recent thing
 * I set on another machine"), writes the merged result back to localStorage,
 * and pushes any local-only builds (never synced before) up to Supabase.
 */
export async function pullAndMergeLoadouts(userId: string): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('hero_loadouts')
    .select('hero_slug, regular_item_slugs, neutral_item_slug, situational_item_slugs, situational_neutral_item_slugs, note')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to pull synced hero builds', error);
    return;
  }

  const local = loadHeroItemLoadouts();
  const remote = (data ?? []) as HeroLoadoutRow[];
  const remoteSlugs = new Set(remote.map((r) => r.hero_slug));

  const merged: Record<string, HeroItemLoadout> = { ...local };
  for (const row of remote) {
    merged[row.hero_slug] = {
      regularItemSlugs: row.regular_item_slugs,
      neutralItemSlug: row.neutral_item_slug,
      situationalItemSlugs: row.situational_item_slugs ?? [],
      situationalNeutralItemSlugs: row.situational_neutral_item_slugs ?? [],
      note: row.note ?? '',
    };
  }
  saveHeroItemLoadouts(merged);

  const localOnly = Object.entries(local).filter(([slug]) => !remoteSlugs.has(slug));
  for (const [heroSlug, loadout] of localOnly) {
    await pushLoadout(userId, heroSlug, loadout);
  }
}

/** Upserts one hero's build to Supabase. Call whenever a signed-in user's loadout changes. */
export async function pushLoadout(userId: string, heroSlug: string, loadout: HeroItemLoadout): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('hero_loadouts').upsert({
    user_id: userId,
    hero_slug: heroSlug,
    regular_item_slugs: loadout.regularItemSlugs,
    neutral_item_slug: loadout.neutralItemSlug,
    situational_item_slugs: loadout.situationalItemSlugs,
    situational_neutral_item_slugs: loadout.situationalNeutralItemSlugs,
    note: loadout.note,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('Failed to sync hero build', heroSlug, error);
}
