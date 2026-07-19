-- Starter cosmetics catalog (~50 items). colorways.primary/secondary drive
-- the primitive renderer; when real GLB assets exist, set asset_url and the
-- client automatically prefers it (see mobile buildAvatar.js SWAP POINT).
insert into public.items
  (id, category, rarity, name, colorways, min_level, unlock_type, price_coins, price_gems) values

-- hair (color comes from built-in HAIR_COLORS, so colorways stay empty) ---
('hr_short',     'hair', 'common',   'Short Crop',   '[]', 1,  'default', null, null),
('hr_buzz',      'hair', 'common',   'Buzz',         '[]', 1,  'default', null, null),
('hr_bob',       'hair', 'common',   'Bob',          '[]', 1,  'default', null, null),
('hr_pony',      'hair', 'common',   'Ponytail',     '[]', 1,  'default', null, null),
('hr_wolfcut',   'hair', 'uncommon', 'Wolf Cut',     '[]', 5,  'level',   null, null),
('hr_curls',     'hair', 'uncommon', 'Curls',        '[]', 5,  'level',   null, null),
('hr_long',      'hair', 'uncommon', 'Long Flow',    '[]', 1,  'shop',    700,  null),
('hr_bun',       'hair', 'uncommon', 'Top Bun',      '[]', 1,  'shop',    700,  null),
('hr_spikes',    'hair', 'rare',     'Spikes',       '[]', 1,  'shop',    1500, null),
('hr_neon_flow', 'hair', 'epic',     'Neon Flow',    '[{"id":"c1","primary":"#8B7CFF"}]', 30, 'shop', null, 250),

-- tops --------------------------------------------------------------------
('it_tee_slate',    'top', 'common',   'Slate Tee',     '[{"id":"c1","primary":"#5A6273"}]', 1, 'default', null, null),
('it_tee_beam',     'top', 'common',   'Beam Tee',      '[{"id":"c1","primary":"#8B7CFF"}]', 1, 'shop', 250, null),
('it_tee_crimson',  'top', 'common',   'Crimson Tee',   '[{"id":"c1","primary":"#B4362F"}]', 1, 'shop', 250, null),
('it_shirt_noir',   'top', 'uncommon', 'Noir Shirt',    '[{"id":"c1","primary":"#20242E"}]', 1, 'shop', 550, null),
('it_hoodie_ink',   'top', 'uncommon', 'Ink Hoodie',    '[{"id":"c1","primary":"#1B1F2E","secondary":"#141826"}]', 1, 'shop', 600, null),
('it_jersey_amber', 'top', 'rare',     'Amber Jersey',  '[{"id":"c1","primary":"#FFB454","secondary":"#20242E"}]', 1, 'shop', 1400, null),
('it_hoodie_beam',  'top', 'rare',     'Beam Hoodie',   '[{"id":"c1","primary":"#8B7CFF","secondary":"#141826"}]', 15, 'shop', 1500, null),
('it_jacket_cy',    'top', 'epic',     'Cyan Circuit Jacket', '[{"id":"c1","primary":"#35E0D0","secondary":"#0B0D14"}]', 15, 'shop', 4500, null),

-- bottoms -----------------------------------------------------------------
('it_jeans_ink',     'bottom', 'common',   'Ink Jeans',      '[{"id":"c1","primary":"#2A3242"}]', 1, 'default', null, null),
('it_cargo_black',   'bottom', 'common',   'Black Cargos',   '[{"id":"c1","primary":"#1B1B22"}]', 1, 'shop', 300, null),
('it_shorts_beam',   'bottom', 'common',   'Beam Shorts',    '[{"id":"c1","primary":"#8B7CFF"}]', 1, 'shop', 250, null),
('it_joggers_slate', 'bottom', 'uncommon', 'Slate Joggers',  '[{"id":"c1","primary":"#4A5266"}]', 1, 'shop', 500, null),
('it_pants_cy',      'bottom', 'rare',     'Navy Techpants', '[{"id":"c1","primary":"#2C4A8A"}]', 1, 'shop', 1200, null),

-- shoes -------------------------------------------------------------------
('it_sneaker_white', 'shoes', 'common',   'White Sneakers', '[{"id":"c1","primary":"#EDEFF4"}]', 1, 'default', null, null),
('it_slides_amber',  'shoes', 'common',   'Amber Slides',   '[{"id":"c1","primary":"#FFB454"}]', 1, 'shop', 200, null),
('it_boots_ink',     'shoes', 'uncommon', 'Ink Boots',      '[{"id":"c1","primary":"#1B1B22"}]', 1, 'shop', 500, null),
('it_runner_cy',     'shoes', 'rare',     'Cyan Runners',   '[{"id":"c1","primary":"#35E0D0"}]', 1, 'shop', 1200, null),
('it_kicks_violet',  'shoes', 'epic',     'Violet Kicks',   '[{"id":"c1","primary":"#A46CFF"}]', 15, 'shop', 4000, null),

-- full outfits (override top+bottom) ---------------------------------------
('it_fit_neon_dress', 'outfit_full', 'epic',      'Neon Dress',  '[{"id":"c1","primary":"#D25BAE","secondary":"#0B0D14"}]', 15, 'shop', 5000, null),
('it_fit_noir_suit',  'outfit_full', 'legendary', 'Noir Suit',   '[{"id":"c1","primary":"#12141C","secondary":"#8B7CFF"}]', 1, 'shop', null, 700),
('it_fit_cyber',      'outfit_full', 'legendary', 'Cyber Rig',   '[{"id":"c1","primary":"#35E0D0","secondary":"#0B0D14"}]', 1, 'shop', null, 800),

-- accessories ---------------------------------------------------------------
('it_cap_wp',        'acc_head',  'common',    'WP Cap',          '[{"id":"c1","primary":"#8B7CFF"}]', 1, 'shop', 300, null),
('it_beanie_ink',    'acc_head',  'common',    'Ink Beanie',      '[{"id":"c1","primary":"#1B1B22"}]', 1, 'shop', 250, null),
('it_crown_gold',    'acc_head',  'legendary', 'Gilded Crown',    '[{"id":"c1","primary":"#FFB454"}]', 1, 'shop', null, 900),
('it_headphones_x',  'acc_ears',  'rare',      'X-Phones',        '[{"id":"c1","primary":"#20242E","secondary":"#8B7CFF"}]', 1, 'shop', 1500, null),
('it_buds_cy',       'acc_ears',  'uncommon',  'Cyan Buds',       '[{"id":"c1","primary":"#35E0D0"}]', 1, 'shop', 500, null),
('it_glasses_round', 'acc_face',  'common',    'Round Glasses',   '[{"id":"c1","primary":"#20242E"}]', 1, 'shop', 250, null),
('it_shades_noir',   'acc_face',  'rare',      'Noir Shades',     '[{"id":"c1","primary":"#12141C"}]', 1, 'shop', 1200, null),
('it_visor_neon',    'acc_face',  'epic',      'Neon Visor',      '[{"id":"c1","primary":"#35E0D0"}]', 15, 'shop', 4200, null),
('it_popcorn',       'acc_hands', 'common',    'Popcorn Bucket',  '[{"id":"c1","primary":"#B4362F","secondary":"#F4F6FA"}]', 1, 'default', null, null),
('it_soda_cy',       'acc_hands', 'common',    'Cyan Soda',       '[{"id":"c1","primary":"#35E0D0"}]', 1, 'shop', 200, null),
('it_controller',    'acc_hands', 'uncommon',  'Controller',      '[{"id":"c1","primary":"#20242E"}]', 1, 'shop', 500, null),
('it_pack_glow',     'acc_back',  'rare',      'Glow Pack',       '[{"id":"c1","primary":"#8B7CFF"}]', 1, 'shop', 1300, null),
('it_guitar',        'acc_back',  'epic',      'Back Guitar',     '[{"id":"c1","primary":"#B4362F"}]', 15, 'shop', 4200, null),
('it_wings_neon',    'acc_back',  'legendary', 'Neon Wings',      '[{"id":"c1","primary":"#35E0D0"}]', 1, 'shop', null, 800),

-- effects (equip slot unlocks at Level 30 by design) -------------------------
('fx_petals',      'effect', 'uncommon', 'Petal Fall',   '[{"id":"c1","primary":"#E6799B"}]', 30, 'shop', 900,  null),
('fx_sparks',      'effect', 'rare',     'Static Sparks','[{"id":"c1","primary":"#35E0D0"}]', 30, 'shop', 2000, null),
('fx_ember',       'effect', 'epic',     'Ember Drift',  '[{"id":"c1","primary":"#E0642F"}]', 30, 'shop', 5000, null),
('fx_aura_violet', 'effect', 'epic',     'Violet Aura',  '[{"id":"c1","primary":"#8B7CFF"}]', 30, 'shop', 5500, null),

-- frames ----------------------------------------------------------------------
('fr_slate',      'frame', 'common',    'Slate Ring',  '[{"id":"c1","primary":"#9AA3B2"}]', 10, 'level', null, null),
('fr_beam',       'frame', 'uncommon',  'Beam Ring',   '[{"id":"c1","primary":"#8B7CFF"}]', 10, 'shop', 800,  null),
('fr_neon_pulse', 'frame', 'epic',      'Neon Pulse',  '[{"id":"c1","primary":"#A46CFF"}]', 10, 'shop', 4500, null),
('fr_fire',       'frame', 'epic',      'Fire Ring',   '[{"id":"c1","primary":"#E0642F"}]', 10, 'shop', 5000, null),
('fr_gold',       'frame', 'legendary', 'Gold Frame',  '[{"id":"c1","primary":"#FFB454"}]', 10, 'shop', null, 600),

-- backgrounds (primary = top of gradient, secondary = bottom) ------------------
('bg_room',    'background', 'common',   'Personal Room', '[{"id":"c1","primary":"#141826","secondary":"#0B0D14"}]', 1, 'default', null, null),
('bg_cinema',  'background', 'common',   'Cinema Row',    '[{"id":"c1","primary":"#2A1218","secondary":"#12060A"}]', 1, 'shop', 400,  null),
('bg_music',   'background', 'common',   'Music Studio',  '[{"id":"c1","primary":"#101A2E","secondary":"#0A0F1E"}]', 1, 'shop', 400,  null),
('bg_gaming',  'background', 'uncommon', 'Gaming Den',    '[{"id":"c1","primary":"#0F2420","secondary":"#08110F"}]', 1, 'shop', 600,  null),
('bg_rooftop', 'background', 'rare',     'Night Rooftop', '[{"id":"c1","primary":"#1A1030","secondary":"#0A0618"}]', 1, 'shop', 1500, null),
('bg_fantasy', 'background', 'epic',     'Fantasy Gate',  '[{"id":"c1","primary":"#10262E","secondary":"#071318"}]', 15, 'shop', 4000, null)

on conflict (id) do update set
  category = excluded.category, rarity = excluded.rarity, name = excluded.name,
  colorways = excluded.colorways, min_level = excluded.min_level,
  unlock_type = excluded.unlock_type, price_coins = excluded.price_coins,
  price_gems = excluded.price_gems;
