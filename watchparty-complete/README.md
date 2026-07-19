# WatchParty — Avatars, Progression, Shop & Games (complete drop-in package)

One integrated package for your existing stack (Express + Socket.IO +
Supabase backend, Expo/React Native app):

- **3D Avatar system** — recipe-based avatars, Avatar Studio, Quick Create,
  2D snapshots for chat/lists (replaces DiceBear)
- **Progression** — XP with server-enforced caps, levels + titles
  (Level 25 = 8,500/10,000 XP), login streaks with shields, level rewards
- **Economy** — coins/gems wallet (ledger-first), shop with daily featured
  rotation, gifting
- **Games** — 🎴 WildBeam (Crazy-Eights-family card game, 2-8 players, all
  original naming/colors — no UNO trademark issues) and 🧠 Match Blitz
  (memory pairs, 2-6), on a pluggable engine your Ludo can join later

Games automatically grant avatar XP (`game_play` +15/day-capped,
`game_win` +30) — already wired, nothing to patch.

```
watchparty-complete/
├── supabase/
│   ├── migrations/001_avatar_system.sql    schema + RLS + storage bucket
│   ├── migrations/003_game_results.sql     game history
│   └── seed/002_items_seed.sql             ~55 starter cosmetics
├── avatar-core/       SHARED: recipe validation, level math, XP rules
├── server/
│   ├── avatar/        Express module (catalog, avatar, XP, shop, gifts)
│   └── games/         Socket.IO game engine + WildBeam + Match Blitz
├── mobile/
│   ├── avatar/        Studio, QuickCreate, Profile, Inventory, Shop, 3D stage
│   └── games/         WildBeam + Match Blitz screens, GamePickerSheet
└── tests/simulate.js  run `node tests/simulate.js` (400 full games)
```

---

## 1. Database (5 min)

Run in the Supabase SQL editor, in order:
1. `supabase/migrations/001_avatar_system.sql`
2. `supabase/migrations/003_game_results.sql`
3. `supabase/seed/002_items_seed.sql`

## 2. Backend (10 min)

Copy three folders into your backend source so they're **siblings**
(imports are relative):

```
backend/src/avatar-core/
backend/src/avatar/
backend/src/games/
```

Env:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # rotate this key if you haven't since it
                                # was exposed earlier
AVATAR_BUCKET=avatars           # optional (default)
AVATAR_DEV_KEY=some-secret      # optional: enables POST /progression/grant for testing
```

Wire both modules (CommonJS; if your backend is ESM, only the
require/module.exports lines change):

```js
const { createAvatarModule, grantXp } = require('./avatar');
const { attachGamesWithAvatarXp } = require('./games');

app.use('/api/v1/avatar-system', createAvatarModule().router);
attachGamesWithAvatarXp(io);   // io = your existing Socket.IO server
```

Both assume your socket/HTTP auth: HTTP routes take the Supabase JWT as
`Authorization: Bearer`, sockets need `socket.data.userId` set at
handshake (replace `server/avatar/requireUser.js` with your middleware if
you already have one).

Grant XP from your existing room handlers (caps enforced inside):
```js
const r = await grantXp(userId, 'join', { refId: roomId });   // or host/watch/invite...
if (r.granted) socket.emit('xp:awarded', r);
// r.leveledUp, r.coinsAwarded, r.itemsUnlocked -> toast material
```
See `server/avatar/events.example.js` for verified-presence timing
(join counts after 5 min, host after 10 min with an audience).

## 3. Mobile (15 min)

Copy into your Expo app, again as siblings:

```
app-src/avatar-core/
app-src/avatar/
app-src/games/
```

Dependencies (games need none beyond what you have):
```
npx expo install expo-gl expo-file-system
npm i three@0.166.1 expo-three@^8.0.0 zustand
```

Configure once at app start:
```js
import { configureAvatarApi, useAvatarStore, AvatarApi } from './avatar';

configureAvatarApi({
  baseUrl: 'https://sandipwatch7.dedyn.io/api/v1/avatar-system',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
});
// after login:
useAvatarStore.getState().init();
AvatarApi.claimLogin();   // daily streak (idempotent per UTC day)
```

Screens to register (expo-router or react-navigation — wrapper examples
below use react-navigation):

```jsx
import {
  StudioScreen, QuickCreateScreen, ProfileScreen,
  InventoryScreen, ShopScreen, SnapshotAvatar,
} from './avatar';
import { GamePickerSheet, WildBeamScreen, MatchBlitzScreen } from './games';

<Stack.Screen name="AvatarStudio">
  {({ navigation }) => <StudioScreen onClose={() => navigation.goBack()} />}
</Stack.Screen>
<Stack.Screen name="Game">
  {({ navigation, route }) => route.params.gameId === 'wildbeam'
    ? <WildBeamScreen socket={socket} sessionId={route.params.sessionId}
        meId={user.id} playersMeta={membersById}
        onExit={() => navigation.goBack()} />
    : <MatchBlitzScreen socket={socket} sessionId={route.params.sessionId}
        meId={user.id} playersMeta={membersById}
        onExit={() => navigation.goBack()} />}
</Stack.Screen>
```

Launch a game from your room UI:
```jsx
<GamePickerSheet socket={socket} roomId={roomId}
  onCreated={(session) => {
    // share session.sessionId with the room (chat message / room state),
    // then everyone navigates:
    navigation.navigate('Game', session);
  }} />
```

The two systems meet nicely in `playersMeta`: pass each member's avatar
snapshot so game tables show real avatars —
```js
const card = await AvatarApi.card(userId);
membersById[userId] = { name: card.name, avatarUrl: card.snapshots.head };
```

Replace DiceBear anywhere with:
```jsx
<SnapshotAvatar url={card.snapshots.head ?? diceBearUrl} presence="watching" size={40} />
```

## API + socket reference

HTTP (`/api/v1/avatar-system`):

| Method | Path | What |
|---|---|---|
| GET  | /catalog/manifest | cosmetics catalog (60 s cache) |
| GET / PUT | /avatar/me | my avatar / save recipe (422 + details if locked) |
| POST | /avatar/me/snapshots | upload head/bust/full PNGs |
| GET  | /avatar/card/:userId | public card: name, level, snapshots |
| GET  | /inventory/me | owned items |
| GET  | /progression/me | level, XP, wallet, streak, titles |
| POST | /progression/login/claim | daily streak claim |
| GET  | /stats/me | profile stats grid |
| GET  | /shop | featured rotation (2 discounted daily) + catalog |
| POST | /shop/purchase | buy (server-side pricing, level/owned checks) |
| POST | /gifts · GET /gifts/me · POST /gifts/:id/open | gifting |

Sockets (games): `game:create/list/join/start/move/leave` in;
`game:lobby/state/hand/events/ended` + `xp:awarded` out.
WildBeam moves: `{type:'play',cardId,chooseColor?,callLastCard?}` /
`{type:'draw'}` / `{type:'pass'}`. Match Blitz: `{type:'flip',index}`.

## Extending

- **New game**: one rules file shaped like `server/games/wildbeam.js`,
  register in `engine.js` GAMES, add a screen. Lobby/timers/reconnects are
  inherited. Your Ludo can be ported the same way.
- **Real 3D assets**: set `items.asset_url` to a GLB and swap the primitive
  branch in `mobile/avatar/three/buildAvatar.js` (marked SWAP POINT).
  Recipe, validation, Studio, snapshots all stay unchanged.
- **Not included**: 3D lobbies/emote sockets (Phase 3 — contracts in the
  design doc), IAP gem top-ups (needs store receipt verification),
  achievements engine (tables ready).

## Verify before integrating

```
node tests/simulate.js     # 400 full games, card conservation, guards
```
All 50 JS/JSX files in this package are syntax-checked; the shared level
math is unit-checked against the design examples.
