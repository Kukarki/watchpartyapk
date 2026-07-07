# WatchParty — Senior Engineer Codebase Audit

**Date:** June 2026  
**Scope:** Full codebase — backend, frontend, browser extension  
**Stack:** Node.js · Express · Socket.io · Supabase · React · Zustand · WebRTC

---

## Executive Summary

The project has a solid foundation: clean socket handler separation, a reasonable Zustand + Context architecture, and working WebRTC signaling. However there are **4 critical runtime bugs** that cause features to completely fail in production, **3 security issues**, and a scattered set of architecture and code-quality problems. All findings are documented below with severity ratings and exact file/line references.

---

## Critical Bugs (features broken at runtime)

### 1. `sb.raw()` does not exist — queue voting crashes

**File:** `backend/src/controllers/queue.controller.js`, lines 78 & 83  
**Severity:** 🔴 Critical

```js
// BROKEN — Supabase JS has no .raw() method
await sb.from('queue_items')
  .update({ vote_count: sb.raw('vote_count - 1') })
  .eq('id', itemId);
```

The Supabase JavaScript client has no `.raw()` method. This call throws `TypeError: sb.raw is not a function` every time a user tries to toggle a vote, crashing the request with a 500 and leaving vote counts permanently wrong.

**Fix:** Use Supabase RPC for atomic increment/decrement (avoids a race condition too).

---

### 2. Queue and Poll routes are never mounted — all 404

**File:** `backend/src/routes/room.routes.js` and `backend/src/routes/index.js`  
**Severity:** 🔴 Critical

`room.routes.js` only registers three endpoints:
```
POST /rooms/
GET  /rooms/:roomId
GET  /rooms/:roomId/chat
```

But the frontend calls nine more:
```
GET    /rooms/:roomId/queue
POST   /rooms/:roomId/queue
POST   /rooms/:roomId/queue/:itemId/vote
DELETE /rooms/:roomId/queue/:itemId
POST   /rooms/:roomId/queue/play-next
GET    /rooms/:roomId/polls/active
POST   /rooms/:roomId/polls
POST   /rooms/:roomId/polls/:pollId/vote/:optionIndex
PATCH  /rooms/:roomId/polls/:pollId/end
```

Every queue and poll API call from the frontend returns 404. The entire queue and polling feature is silently broken.

**Fix:** Create `queue.routes.js` and `poll.routes.js`, add them to `room.routes.js` as nested sub-routers.

---

### 3. `auth.routes.js` is never mounted — email auth unreachable

**File:** `backend/src/routes/index.js`  
**Severity:** 🔴 Critical

`auth.routes.js` contains `register`, `login`, `supabaseCallback`, `updateProfile`, and full `getMe`. It is **never imported or mounted** anywhere. `routes/index.js` mounts `userRoutes` which maps to `user.routes.js` — a stripped-down duplicate with only guest login and a minimal getMe.

Result: Email registration, email login, OAuth callback, and profile updates are all unreachable. Two conflicting controller files exist: `auth.controller.js` (full-featured, unreachable) and `user.controller.js` (minimal, used).

**Fix:** Mount `auth.routes.js` at `/api/v1/auth` and remove the redundant `user.routes.js` + `user.controller.js`.

---

### 4. `lobbyPage.jsx` — wrong casing, Linux build failure

**File:** `frontend/src/pages/lobbyPage.jsx`  
**Severity:** 🔴 Critical (on Linux/CI)

`App.jsx` imports:
```js
import LobbyPage from '@/pages/LobbyPage.jsx';
```

But the file on disk is `lobbyPage.jsx`. On Windows (case-insensitive filesystem) this works. On Linux (CI, Docker, production) this is a build-breaking import error.

**Fix:** Rename file to `LobbyPage.jsx`.

---

## Security Issues

### 5. JWT secret silently defaults to weak value in production

**File:** `backend/src/config/index.js`, line 15  
**Severity:** 🟠 High

```js
secret: process.env.JWT_SECRET || 'dev_secret_change_in_prod',
```

If `JWT_SECRET` is missing from the production environment, all tokens are signed with a known public string. An attacker can forge arbitrary JWTs and impersonate any user.

**Fix:** Throw at startup if `JWT_SECRET` is missing in production.

---

### 6. Poll vote count has a read-modify-write race condition

**File:** `backend/src/controllers/poll.controller.js`, lines 86–96  
**Severity:** 🟠 High

```js
// Reads existing.poll_options.vote_count then writes count - 1
await sb.from('poll_options')
  .update({ vote_count: existing.poll_options.vote_count - 1 })
  .eq('id', existing.option_id);
```

Two concurrent requests can both read the same count and both subtract 1, dropping the count by only 1 instead of 2 (or vice-versa). Under real user load vote counts will drift.

**Fix:** Use a Supabase RPC function with `UPDATE ... SET vote_count = vote_count - 1` — an atomic single statement.

---

### 7. OAuth callback trusts client-supplied `userId` without verification

**File:** `backend/src/controllers/auth.controller.js`, `supabaseCallback`  
**Severity:** 🟠 High

```js
const { supabaseToken, userId, email, displayName, avatar } = req.body;
// Token is present but userId comes from the request body — not extracted from the token
```

The server upserts a profile for whatever `userId` the client sends, as long as *some* supabaseToken is present (it doesn't verify the token claims match the userId). A malicious client can claim any userId and overwrite another user's profile.

**Fix:** Verify the Supabase JWT server-side using `getSupabase().auth.getUser(supabaseToken)` and extract userId from the verified token, not from the request body.

---

## Architecture Issues

### 8. `RoomService` instantiated twice — two independent instances

**Files:** `backend/src/controllers/room.controller.js` line 5, `backend/src/socket/room.socket.js` line 4  
**Severity:** 🟡 Medium

```js
// In both files:
const roomService = new RoomService();
```

Both call `new RoomService()` at module load time. While `RoomService` is currently stateless (it only wraps Supabase), this is fragile — any future in-memory cache in the service will be split across two instances and desync. 

**Fix:** Export a singleton from `room.service.js`.

---

### 9. `VideoService` exists but is never used

**File:** `backend/src/services/video.service.js`  
**Severity:** 🟡 Medium

`VideoService` with `reconcileTime` and `isOutOfSync` is fully implemented but never imported anywhere. The socket handler does its own inline time logic. Dead code that will mislead future developers.

**Fix:** Either wire it into `room.socket.js` (replaces the inline logic there) or delete it.

---

### 10. Dead `authenticateSocket` in `middleware/auth.js`

**File:** `backend/src/middleware/auth.js`, lines 19–31  
**Severity:** 🟡 Medium

An `authenticateSocket` function is exported but never imported. The socket server in `socket/index.js` has its own inline auth middleware. The dead export is a maintenance trap — developers will trust it and try to use it, not knowing it's bypassed.

**Fix:** Delete the dead export.

---

### 11. `getPublicRooms` controller bypasses the service layer

**File:** `backend/src/controllers/room.controller.js`, lines 47–60  
**Severity:** 🟡 Medium

```js
// Direct Supabase query in a controller — should go through RoomService
const { data, error } = await getSupabaseAdmin()
  .from('rooms')
  .select('room_id, name, host_id, ...')
```

All other room operations go through `RoomService`. This one goes direct. It breaks the abstraction layer — the controller now knows about DB column names, making future DB changes require touching controllers too.

**Fix:** Add `listPublicRooms()` to `RoomService`.

---

### 12. UI state duplication — `sidebarTab` in both Zustand and local state

**File:** `frontend/src/pages/RoomPage.jsx` line 27, `frontend/src/store/roomStore.js` line 31  
**Severity:** 🟡 Medium

`roomStore` has a `sidebarTab` field with `setSidebarTab` action. `RoomPage` ignores it and creates its own `const [sidebarTab, setSidebarTab] = useState('chat')`. The store state is dead.

**Fix:** Either remove `sidebarTab` from the store and keep local state (simpler), or use the store and remove local state.

---

## Code Quality Issues

### 13. `console.log` in production code

**Files:**
- `frontend/src/pages/RoomPage.jsx` line 29
- `frontend/src/contexts/RoomContext.jsx` lines 21, 26, 117
- `frontend/src/contexts/SocketContext.jsx` lines 57, 62, 71, 88

All of these log internal state on every render or socket event. In production this leaks internal architecture to the browser console and degrades performance.

**Fix:** Remove all `console.log` calls. Keep `console.warn` only for actionable developer warnings.

---

### 14. `voice:leave` handler destructures params it never reads

**File:** `backend/src/socket/voice.socket.js`, line 36

```js
socket.on('voice:leave', ({ roomId, channelId = 'general' } = {}) => {
  _leaveVoice(io, socket); // reads socket.data, not the params
});
```

The destructured `roomId` and `channelId` are never used. `_leaveVoice` reads `socket.data.voiceRoom` and `socket.data.voiceChannel` instead. This is correct behavior but the unused parameters are misleading.

**Fix:** Change signature to `() =>`.

---

### 15. Inconsistent timestamp storage

**File:** `backend/src/services/room.service.js`, line 27

```js
state_updated_at: Date.now()  // stores a JS epoch integer (ms)
```

Other timestamps use `new Date().toISOString()`. The `state_updated_at` column presumably expects a timestamp type but receives a raw integer. The mapper returns it as-is and the frontend uses it for elapsed-time calculations — it accidentally works because the math is all in ms, but it's semantically wrong and will break if Supabase coerces the column type.

**Fix:** Use `new Date().toISOString()` everywhere, or define a single `now()` utility.

---

### 16. Avatar URL generation duplicated three times

**Files:** `user.controller.js` line 20, `auth.controller.js` lines 15 & 62

```js
// Three separate copies of:
`https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`
```

**Fix:** Extract to `src/utils/avatar.js`.

---

### 17. No input validation middleware

**Severity:** 🟡 Medium

Validation is scattered inline across all controllers with `if (!field?.trim()) return res.status(400)`. There's no schema validation (zod, joi, express-validator). As the API grows this approach doesn't scale and leads to inconsistent error shapes.

**Fix:** Add `zod` validation schemas per route, applied as middleware.

---

## Summary Table

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | `sb.raw()` crash in queue voting | 🔴 Critical | queue.controller.js |
| 2 | Queue + Poll routes not mounted | 🔴 Critical | routes/index.js, room.routes.js |
| 3 | Auth routes not mounted | 🔴 Critical | routes/index.js |
| 4 | `lobbyPage.jsx` wrong casing | 🔴 Critical | frontend/src/pages/ |
| 5 | JWT secret fallback in prod | 🟠 High | config/index.js |
| 6 | Poll vote race condition | 🟠 High | poll.controller.js |
| 7 | OAuth callback trusts client userId | 🟠 High | auth.controller.js |
| 8 | RoomService instantiated twice | 🟡 Medium | room.controller.js, room.socket.js |
| 9 | VideoService never used | 🟡 Medium | video.service.js |
| 10 | Dead `authenticateSocket` export | 🟡 Medium | middleware/auth.js |
| 11 | Controller bypasses service layer | 🟡 Medium | room.controller.js |
| 12 | `sidebarTab` duplicated in store + local | 🟡 Medium | RoomPage.jsx, roomStore.js |
| 13 | `console.log` in production | 🟡 Medium | RoomPage, RoomContext, SocketContext |
| 14 | `voice:leave` reads unused params | 🟢 Low | voice.socket.js |
| 15 | Mixed timestamp formats | 🟢 Low | room.service.js |
| 16 | Avatar URL duplicated 3× | 🟢 Low | user/auth controllers |
| 17 | No input validation middleware | 🟡 Medium | all controllers |
