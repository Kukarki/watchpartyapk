-- WatchParty avatar & identity system — schema v1
-- Run with: supabase db push, or paste into the SQL editor.

-- ========== identity ====================================================
create table if not exists public.avatars (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  recipe        jsonb not null,
  recipe_hash   text  not null,
  snapshot_head text,
  snapshot_bust text,
  snapshot_full text,
  version       int   not null default 2,
  updated_at    timestamptz not null default now()
);

-- ========== cosmetics catalog ==========================================
-- Content team writes; clients read via /catalog/manifest.
create table if not exists public.items (
  id           text primary key,              -- 'it_hoodie_beam'
  category     text not null,                 -- hair|top|bottom|shoes|outfit_full|acc_*|effect|frame|background
  rarity       text not null default 'common',
  name         text not null,
  asset_url    text,                          -- GLB url (null = primitive renderer fallback)
  thumb_url    text,
  colorways    jsonb not null default '[]',   -- [{"id":"c1","primary":"#8B7CFF","secondary":"#141826"}]
  min_level    int  not null default 1,
  unlock_type  text not null default 'shop',  -- default|level|shop|achievement|event|gift_only
  unlock_ref   text,
  price_coins  int,
  price_gems   int,
  season       text,
  available_from timestamptz,
  available_to   timestamptz,
  tri_count    int,
  released_at  timestamptz not null default now()
);
create index if not exists items_category_idx on public.items (category);
create index if not exists items_rarity_idx   on public.items (rarity);

create table if not exists public.user_inventory (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.items(id),
  source      text not null,                  -- level|shop|achievement|gift|event|streak
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ========== progression (append-only ledger + cached rollup) ===========
create table if not exists public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null,                   -- join|host|invite|login|challenge_daily|challenge_weekly|social|watch
  amount     int  not null,
  ref_id     text,
  created_at timestamptz not null default now()
);
create index if not exists xp_events_user_time_idx
  on public.xp_events (user_id, source, created_at);

create table if not exists public.user_progression (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  xp         bigint not null default 0,
  level      int    not null default 1,
  title      text   not null default 'Newcomer',
  updated_at timestamptz not null default now()
);

-- ========== economy (ledger-first) ======================================
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins   bigint not null default 0,
  gems    bigint not null default 0
);

create table if not exists public.wallet_tx (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  currency         text not null,             -- coins|gems
  amount           int  not null,             -- signed
  reason           text not null,             -- levelup|streak|purchase|iap|gift_sent|streak_fallback
  ref_id           text,
  platform_receipt text,
  created_at       timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_tx (user_id, created_at);

-- ========== achievements / streaks / social =============================
create table if not exists public.achievements (
  id             text primary key,
  name           text not null,
  criteria       jsonb not null default '{}',
  xp_reward      int not null default 0,
  badge_rarity   text,
  reward_item_id text references public.items(id)
);

create table if not exists public.user_achievements (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id),
  progress       jsonb not null default '{}',
  unlocked_at    timestamptz,
  pinned         boolean not null default false,
  primary key (user_id, achievement_id)
);

create table if not exists public.login_streaks (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  current    int  not null default 0,
  longest    int  not null default 0,
  shields    int  not null default 0,
  last_claim date
);

-- Skip this table if your app already has a friendships/friends table —
-- then point stats.routes.js at yours instead.
create table if not exists public.friendships (
  user_a       uuid not null references auth.users(id) on delete cascade,
  user_b       uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',  -- pending|accepted|blocked
  requested_by uuid,
  created_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)                        -- store each pair once, ordered
);

create table if not exists public.gifts (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null references public.items(id),
  message    text,
  status     text not null default 'sent',       -- sent|opened
  created_at timestamptz not null default now()
);

-- ========== storage bucket for snapshots ================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ========== RLS =========================================================
-- The Express backend uses the service role (bypasses RLS). These policies
-- exist so direct client reads are safe if you ever use supabase-js
-- straight from the app.
alter table public.avatars          enable row level security;
alter table public.items            enable row level security;
alter table public.user_inventory   enable row level security;
alter table public.xp_events        enable row level security;
alter table public.user_progression enable row level security;
alter table public.wallets          enable row level security;
alter table public.wallet_tx        enable row level security;
alter table public.achievements     enable row level security;
alter table public.user_achievements enable row level security;
alter table public.login_streaks    enable row level security;
alter table public.friendships      enable row level security;
alter table public.gifts            enable row level security;

create policy "items are public"        on public.items        for select using (true);
create policy "achievements are public" on public.achievements for select using (true);
create policy "avatars are public read" on public.avatars      for select using (true);
create policy "own inventory"    on public.user_inventory   for select using (auth.uid() = user_id);
create policy "own xp"           on public.xp_events        for select using (auth.uid() = user_id);
create policy "own progression"  on public.user_progression for select using (auth.uid() = user_id);
create policy "own wallet"       on public.wallets          for select using (auth.uid() = user_id);
create policy "own wallet tx"    on public.wallet_tx        for select using (auth.uid() = user_id);
create policy "own achievements" on public.user_achievements for select using (auth.uid() = user_id);
create policy "own streak"       on public.login_streaks    for select using (auth.uid() = user_id);
create policy "own friendships"  on public.friendships      for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "own gifts"        on public.gifts            for select
  using (auth.uid() = from_user or auth.uid() = to_user);
