-- Ready Player Me avatar + inventory system.
--
-- The catalog/inventory/shop/gifts/progression/economy backend module
-- (backend/src/avatar/*) already existed but had zero tracked migrations for
-- any of the tables it depends on -- every meaningful endpoint 500'd. This
-- creates them, matching the exact shapes those existing services already
-- read/write, plus what the new Ready Player Me avatar routes need.
--
-- Safe to run repeatedly (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout).

-- ── Avatar (Ready Player Me) ──────────────────────────────────────────────
-- profiles already has `avatar_url` (now holds a Ready Player Me render URL
-- once a user creates one, DiceBear before that); this adds the per-category
-- equipped-item cache described in the plan as the "users_profile" table.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_items JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Catalog ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id             TEXT         PRIMARY KEY,
  name           TEXT         NOT NULL,
  category       TEXT         NOT NULL,
  rarity         TEXT         NOT NULL DEFAULT 'common',
  asset_url      TEXT,
  price_coins    INTEGER      NOT NULL DEFAULT 0,
  price_gems     INTEGER      NOT NULL DEFAULT 0,
  unlock_type    TEXT         NOT NULL DEFAULT 'shop', -- 'shop' | 'level' | 'event' | 'gift'
  min_level      INTEGER      NOT NULL DEFAULT 1,
  available_from TIMESTAMPTZ,
  available_to   TIMESTAMPTZ,
  released_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category);

-- ── Inventory ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_inventory (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id     TEXT         NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  source      TEXT         NOT NULL DEFAULT 'shop', -- 'shop' | 'gift' | 'level' | 'event'
  acquired_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  equipped    BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON user_inventory (user_id);

-- ── Economy ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT    PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  coins   INTEGER NOT NULL DEFAULT 0,
  gems    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wallet_tx (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  currency   TEXT        NOT NULL, -- 'coins' | 'gems'
  amount     INTEGER     NOT NULL, -- positive = grant, negative = spend
  reason     TEXT        NOT NULL,
  ref_id     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_tx_user_idx ON wallet_tx (user_id);

-- ── Progression / XP ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progression (
  user_id    TEXT        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp         INTEGER     NOT NULL DEFAULT 0,
  level      INTEGER     NOT NULL DEFAULT 1,
  title      TEXT        NOT NULL DEFAULT 'Newcomer',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source     TEXT        NOT NULL,
  amount     INTEGER     NOT NULL,
  ref_id     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_events_user_source_idx ON xp_events (user_id, source);

CREATE TABLE IF NOT EXISTS login_streaks (
  user_id         TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current         INTEGER NOT NULL DEFAULT 0,
  longest         INTEGER NOT NULL DEFAULT 0,
  last_claim_date DATE
);

-- ── Gifts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gifts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user    TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id    TEXT        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  message    TEXT,
  status     TEXT        NOT NULL DEFAULT 'sent', -- 'sent' | 'opened'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS gifts_to_user_idx ON gifts (to_user, status);

-- ── Game results (referenced by game-engine/xpHook.js) ────────────────────
CREATE TABLE IF NOT EXISTS game_results (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT        NOT NULL,
  room_id    TEXT,
  game_id    TEXT,
  ranking    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_results_session_idx ON game_results (session_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same pattern as supabase_migration_v10.sql: every write goes through our
-- own Express server with the Supabase service key, our own JWT auth
-- enforces who can do what, RLS here is meant to be a no-op for that key.
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_tx ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'items', 'user_inventory', 'wallets', 'wallet_tx', 'user_progression',
    'xp_events', 'login_streaks', 'gifts', 'game_results'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', t);
    EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ── Starter catalog ─────────────────────────────────────────────────────
INSERT INTO items (id, name, category, rarity, price_coins, unlock_type, min_level) VALUES
  ('clothes_hoodie_amber',   'Amber Hoodie',        'clothes',          'common',    50,  'shop', 1),
  ('clothes_tee_classic',    'Classic Tee',         'clothes',          'common',    30,  'shop', 1),
  ('clothes_jacket_neon',    'Neon Jacket',         'clothes',          'rare',      200, 'shop', 5),
  ('hats_beanie',            'Beanie',              'hats',             'common',    40,  'shop', 1),
  ('hats_cap_backwards',     'Backwards Cap',       'hats',             'common',    40,  'shop', 1),
  ('hats_crown_gold',        'Gold Crown',          'hats',             'legendary', 1000,'shop', 20),
  ('glasses_round',          'Round Glasses',       'glasses',          'common',    25,  'shop', 1),
  ('glasses_shades',         'Cool Shades',         'glasses',          'uncommon',  75,  'shop', 3),
  ('shoes_sneakers_white',   'White Sneakers',      'shoes',            'common',    35,  'shop', 1),
  ('shoes_boots_combat',     'Combat Boots',        'shoes',            'rare',      150, 'shop', 5),
  ('backgrounds_sunset',     'Sunset',              'backgrounds',      'common',    20,  'shop', 1),
  ('backgrounds_galaxy',     'Galaxy',              'backgrounds',      'epic',      400, 'shop', 10),
  ('room_decorations_plant', 'Potted Plant',        'room_decorations', 'common',    20,  'shop', 1),
  ('room_decorations_neon',  'Neon Sign',           'room_decorations', 'rare',      180, 'shop', 5),
  ('special_items_founder',  'Founder Badge',       'special_items',    'mythic',    0,   'event',1)
ON CONFLICT (id) DO NOTHING;
