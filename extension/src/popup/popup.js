/**
 * popup.js
 * Renders the WatchParty extension popup.
 * Views: Login → Lobby (create/join) → In Room
 */

import { sendMessage, storageGet, storageSet, getRuntime } from '../utils/extension-api.js';

const app = document.getElementById('app');

// ── State ─────────────────────────────────────────────────
let state = {
  view: 'loading',  // loading | login | lobby | room
  user: null,
  roomId: null,
  serverUrl: 'http://localhost:4000',
  platform: null,
  platformUrl: null,
  members: [],
  error: '',
  loading: false,
  activeTab: 'join', // join | create | settings
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  const [bgState, tabInfo] = await Promise.all([
    sendMessage('GET_STATE'),
    sendMessage('GET_ACTIVE_TAB_PLATFORM'),
  ]);

  const serverUrl = bgState.serverUrl || 'http://localhost:4000';

  setState({
    user: bgState.user,
    roomId: bgState.roomId,
    serverUrl,
    platform: tabInfo.platform,
    platformUrl: tabInfo.url,
    view: !bgState.isAuthenticated
      ? 'login'
      : bgState.roomId
      ? 'room'
      : 'lobby',
  });
}

// ── Render ────────────────────────────────────────────────
function render() {
  switch (state.view) {
    case 'loading': app.innerHTML = renderLoading(); break;
    case 'login':   app.innerHTML = renderLogin();   bindLogin();   break;
    case 'lobby':   app.innerHTML = renderLobby();   bindLobby();   break;
    case 'room':    app.innerHTML = renderRoom();    bindRoom();    break;
  }
}

// ── Loading ───────────────────────────────────────────────
function renderLoading() {
  return `
    <div style="display:flex;align-items:center;justify-content:center;height:200px;">
      <div class="spinner" style="width:24px;height:24px;border-width:3px;border-top-color:#f5a623;"></div>
    </div>`;
}

// ── Login view ────────────────────────────────────────────
function renderLogin() {
  return `
    <div class="header">
      <div class="logo">
        <span class="logo-icon">🎬</span>
        <span class="logo-text">Watch<span>Party</span></span>
      </div>
    </div>
    ${renderPlatformBar()}
    <div class="section fade-in">
      <div class="section-label">Get Started</div>
      <div class="input-group">
        <input class="input" id="displayName" placeholder="Your display name" maxlength="30" />
        ${state.error ? `<div class="status-msg error">${state.error}</div>` : ''}
        <button class="btn btn-primary" id="loginBtn">
          ${state.loading ? '<span class="spinner"></span> Joining...' : 'Continue →'}
        </button>
      </div>
      <p style="text-align:center;color:var(--dim);font-size:11px;margin-top:12px;">
        Guest access · No account required
      </p>
    </div>
    <div class="section">
      <div class="section-label">Server</div>
      <div class="settings-row">
        <input class="input" id="serverUrl" value="${state.serverUrl}" placeholder="http://localhost:4000" />
      </div>
    </div>`;
}

function bindLogin() {
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const name = document.getElementById('displayName').value.trim();
    const server = document.getElementById('serverUrl').value.trim();
    if (!name) { setState({ error: 'Please enter a display name' }); return; }

    setState({ loading: true, error: '', serverUrl: server });

    try {
      const res = await fetch(`${server}/api/v1/users/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      await sendMessage('SET_AUTH', { token: data.token, user: data.user });
      setState({ user: data.user, view: 'lobby', loading: false });
    } catch (err) {
      setState({ error: err.message, loading: false });
    }
  });

  document.getElementById('displayName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
}

// ── Lobby view ────────────────────────────────────────────
function renderLobby() {
  const tabs = ['join', 'create', 'settings'];
  return `
    <div class="header">
      <div class="logo">
        <span class="logo-icon">🎬</span>
        <span class="logo-text">Watch<span>Party</span></span>
      </div>
      <button class="btn btn-ghost" id="logoutBtn" style="padding:6px 10px;font-size:12px;">Logout</button>
    </div>
    ${renderPlatformBar()}
    ${renderUserRow()}
    <div class="tab-row">
      ${tabs.map((t) => `<button class="tab ${state.activeTab === t ? 'active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
    </div>
    <div class="section fade-in">
      ${state.activeTab === 'join' ? renderJoinTab() : ''}
      ${state.activeTab === 'create' ? renderCreateTab() : ''}
      ${state.activeTab === 'settings' ? renderSettingsTab() : ''}
      ${state.error ? `<div class="status-msg error" style="margin-top:10px;">${state.error}</div>` : ''}
    </div>`;
}

function renderJoinTab() {
  return `
    <div class="section-label">Join a Room</div>
    <div class="input-group">
      <input class="input mono" id="roomCode" placeholder="ROOM CODE" maxlength="8" />
      <button class="btn btn-primary" id="joinBtn">
        ${state.loading ? '<span class="spinner"></span>' : 'Join Room →'}
      </button>
    </div>`;
}

function renderCreateTab() {
  return `
    <div class="section-label">Create a Room</div>
    <div class="input-group">
      <input class="input" id="roomName" placeholder="Room name (e.g. Movie Night)" maxlength="50" />
      <button class="btn btn-primary" id="createBtn">
        ${state.loading ? '<span class="spinner"></span>' : 'Create Room →'}
      </button>
    </div>`;
}

function renderSettingsTab() {
  return `
    <div class="section-label">Backend Server</div>
    <div class="input-group">
      <input class="input" id="serverUrlSetting" value="${state.serverUrl}" placeholder="http://localhost:4000" />
      <button class="btn btn-ghost" id="saveServerBtn">Save</button>
    </div>
    <p style="color:var(--dim);font-size:11px;margin-top:8px;line-height:1.6;">
      Point this to your WatchParty backend. Use your public URL if sharing with friends remotely.
    </p>`;
}

function bindLobby() {
  // Tabs
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setState({ activeTab: btn.dataset.tab, error: '' }));
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sendMessage('CLEAR_AUTH');
    setState({ user: null, roomId: null, view: 'login', error: '' });
  });

  // Join
  document.getElementById('joinBtn')?.addEventListener('click', async () => {
    const code = document.getElementById('roomCode')?.value.trim().toUpperCase();
    if (!code) { setState({ error: 'Enter a room code' }); return; }
    setState({ loading: true, error: '' });
    try {
      await sendMessage('JOIN_ROOM', { roomId: code, serverUrl: state.serverUrl });
      setState({ roomId: code, view: 'room', loading: false });
    } catch (err) {
      setState({ error: err.message, loading: false });
    }
  });

  // Create
  document.getElementById('createBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('roomName')?.value.trim();
    if (!name) { setState({ error: 'Enter a room name' }); return; }
    setState({ loading: true, error: '' });
    try {
      const token = await getToken();
      const res = await fetch(`${state.serverUrl}/api/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');
      await sendMessage('JOIN_ROOM', { roomId: data.room.id, serverUrl: state.serverUrl });
      setState({ roomId: data.room.id, view: 'room', loading: false });
    } catch (err) {
      setState({ error: err.message, loading: false });
    }
  });

  // Settings save
  document.getElementById('saveServerBtn')?.addEventListener('click', async () => {
    const url = document.getElementById('serverUrlSetting')?.value.trim();
    if (url) {
      await storageSet({ serverUrl: url });
      setState({ serverUrl: url, error: '', activeTab: 'join' });
    }
  });

  document.getElementById('roomCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('joinBtn')?.click();
  });
}

// ── Room view ─────────────────────────────────────────────
function renderRoom() {
  const extensionOrigin = `${location.protocol}//${location.host}`;
  const runtimeId = getRuntime()?.id || location.host.replace('.extension', '');
  const shareUrl = `${location.origin.replace(`chrome-extension://${runtimeId}`, 'http://localhost:5173')}/join/${state.roomId}`;
  return `
    <div class="header">
      <div class="logo">
        <span class="logo-icon">🎬</span>
        <span class="logo-text">Watch<span>Party</span></span>
      </div>
      <span class="badge-live">LIVE</span>
    </div>
    ${renderPlatformBar()}
    <div class="section fade-in">
      <div class="room-card">
        <div class="room-card-header">
          <span class="room-name">Room Active</span>
          <span class="room-code">${state.roomId}</span>
        </div>
        <p style="font-size:12px;color:var(--sub);margin-bottom:10px;">
          Synced on <strong style="color:var(--bright);">${state.platform || 'streaming page'}</strong>
        </p>
        <button class="btn btn-ghost" id="copyInviteBtn" style="width:100%;font-size:12px;">
          🔗 Copy Invite Link
        </button>
      </div>

      <div style="margin-bottom:12px;">
        <div class="section-label">What to do</div>
        <div style="background:var(--raised);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:12px;color:var(--sub);line-height:1.8;">
          1. Make sure you're on the streaming page<br/>
          2. The floating sidebar will appear on the right<br/>
          3. Press play — everyone syncs automatically<br/>
          4. Chat and react in the sidebar overlay
        </div>
      </div>

      ${!state.platform
        ? `<div class="status-msg info">
            Navigate to a supported streaming page (Prime Video, Netflix, Disney+, YouTube, Max, Apple TV+) to activate sync.
          </div>`
        : `<div class="status-msg success">✓ ${state.platform} detected — overlay is active</div>`
      }
    </div>
    <div class="section">
      <button class="btn btn-danger" id="leaveBtn">Leave Room</button>
    </div>`;
}

function bindRoom() {
  document.getElementById('copyInviteBtn')?.addEventListener('click', () => {
    const url = `http://localhost:5173/join/${state.roomId}`;
    navigator.clipboard.writeText(url);
    document.getElementById('copyInviteBtn').textContent = '✓ Copied!';
    setTimeout(() => {
      if (document.getElementById('copyInviteBtn'))
        document.getElementById('copyInviteBtn').textContent = '🔗 Copy Invite Link';
    }, 2000);
  });

  document.getElementById('leaveBtn')?.addEventListener('click', async () => {
    await sendMessage('LEAVE_ROOM');
    setState({ roomId: null, view: 'lobby', activeTab: 'join' });
  });
}

// ── Shared partials ───────────────────────────────────────

function renderPlatformBar() {
  const active = !!state.platform;
  return `
    <div class="platform-bar">
      <div class="platform-dot ${active ? '' : 'inactive'}"></div>
      <span>${active ? state.platform : 'No streaming page detected'}</span>
    </div>`;
}

function renderUserRow() {
  if (!state.user) return '';
  return `
    <div style="padding:10px 16px;">
      <div class="user-row">
        <img class="user-avatar" src="${state.user.avatar}" onerror="this.style.display='none'" />
        <div>
          <div class="user-name">${state.user.displayName}</div>
          <div class="user-role">Guest</div>
        </div>
      </div>
    </div>`;
}

// ── Utils ─────────────────────────────────────────────────

async function getToken() {
  const data = await storageGet(['token']);
  return data.token;
}

// ── Start ─────────────────────────────────────────────────
init();