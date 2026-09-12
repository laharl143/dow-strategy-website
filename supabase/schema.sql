-- Hero "Core Items" builds, synced per signed-in user across machines.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create table if not exists hero_loadouts (
  user_id uuid not null references auth.users (id) on delete cascade,
  hero_slug text not null,
  regular_item_slugs jsonb not null default '[]'::jsonb,
  neutral_item_slug text,
  situational_item_slugs jsonb not null default '[]'::jsonb,
  situational_neutral_item_slugs jsonb not null default '[]'::jsonb,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, hero_slug)
);

-- Migration for a table created before these columns existed — safe to
-- re-run, `if not exists` makes each statement a no-op once applied.
alter table hero_loadouts add column if not exists situational_item_slugs jsonb not null default '[]'::jsonb;
alter table hero_loadouts add column if not exists situational_neutral_item_slugs jsonb not null default '[]'::jsonb;
alter table hero_loadouts add column if not exists note text not null default '';

-- Multi-build support (DOW-7): a hero can now have several named builds
-- (shown as tabs on the hero page), so the row key grows a build_id and the
-- old single-row-per-hero primary key is replaced with one that includes it.
-- Aghs Scepter/Shard flags move onto each build row too (previously only
-- tracked client-side, never synced).
alter table hero_loadouts add column if not exists build_id text;
alter table hero_loadouts add column if not exists build_name text not null default 'Build 1';
alter table hero_loadouts add column if not exists has_scepter boolean not null default false;
alter table hero_loadouts add column if not exists has_shard boolean not null default false;

-- Autocast indicator (DOW-9): a per-slot "this item is on autocast" flag,
-- Core Items only — situational items don't support it.
alter table hero_loadouts add column if not exists regular_item_autocast jsonb not null default '[]'::jsonb;
alter table hero_loadouts add column if not exists neutral_item_autocast boolean not null default false;

-- Backfill build_id for any pre-existing single-build rows, then make it
-- required and fold it into the primary key. Safe to re-run: once every row
-- has a build_id and the composite key exists, these are no-ops.
create extension if not exists pgcrypto;
update hero_loadouts set build_id = gen_random_uuid()::text where build_id is null;
alter table hero_loadouts alter column build_id set not null;
alter table hero_loadouts drop constraint if exists hero_loadouts_pkey;
alter table hero_loadouts add primary key (user_id, hero_slug, build_id);

alter table hero_loadouts enable row level security;

drop policy if exists "select own hero loadouts" on hero_loadouts;
create policy "select own hero loadouts"
  on hero_loadouts for select
  using (auth.uid() = user_id);

drop policy if exists "insert own hero loadouts" on hero_loadouts;
create policy "insert own hero loadouts"
  on hero_loadouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own hero loadouts" on hero_loadouts;
create policy "update own hero loadouts"
  on hero_loadouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own hero loadouts" on hero_loadouts;
create policy "delete own hero loadouts"
  on hero_loadouts for delete
  using (auth.uid() = user_id);

-- Hero Combo (special-ability) giver assignments (DOW-57), synced per
-- signed-in user across machines the same way hero_loadouts above is —
-- without this, clearAccountScopedLocalData()'s sign-out cleanup (added by
-- DOW-41 to stop combo tags leaking to the next account on a shared
-- browser) has nothing to restore them from, permanently destroying them.
create table if not exists hero_combos (
  user_id uuid not null references auth.users (id) on delete cascade,
  hero_slug text not null,
  giver_slugs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, hero_slug)
);

alter table hero_combos enable row level security;

drop policy if exists "select own hero combos" on hero_combos;
create policy "select own hero combos"
  on hero_combos for select
  using (auth.uid() = user_id);

drop policy if exists "insert own hero combos" on hero_combos;
create policy "insert own hero combos"
  on hero_combos for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own hero combos" on hero_combos;
create policy "update own hero combos"
  on hero_combos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own hero combos" on hero_combos;
create policy "delete own hero combos"
  on hero_combos for delete
  using (auth.uid() = user_id);
