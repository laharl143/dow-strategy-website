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

alter table hero_loadouts enable row level security;

create policy "select own hero loadouts"
  on hero_loadouts for select
  using (auth.uid() = user_id);

create policy "insert own hero loadouts"
  on hero_loadouts for insert
  with check (auth.uid() = user_id);

create policy "update own hero loadouts"
  on hero_loadouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own hero loadouts"
  on hero_loadouts for delete
  using (auth.uid() = user_id);
