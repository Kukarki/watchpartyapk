/**
 * overlay.js
 * Runs inside the iframe injected on streaming pages.
 * Communicates with content-main.js via postMessage.
 * Handles: chat UI, voice WebRTC, reactions, member list.
 */

// ── Constants ─────────────────────────────────────────────
const QUICK_REACTIONS = ['❤️','😂','😮','🔥','👏','😭','🤣','💯','👍','😍'];
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── State ─────────────────────────────────────────────────
const state = {
  user: null,
  roomId: null,
  platform: null,
  platformColor: null,
  connected: false,
  members: [],
  messages: [],
  typingUsers: {},
  voiceMembers: [],
  inVoice: false,
  isMuted: false,
  activeTab: 'chat',
  panelOpen: false,
  peers: {},             // { userId: RTCPeerConnection }
  audioEls: {},          // { userId: HTMLAudioElement }
  localStream: null,
  reactionFeed: [],
};

// ── DOM refs ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const panel        = $('panel');
const toggleTab    = $('toggle-tab');
const connDot      = $('connDot');
const platformName = $('platformName');
const membersStrip = $('membersStrip');
const messagesList = $('messagesList');
const typingBar    = $('typingBar');
const chatInput    = $('chatInput');
const sendBtn      = $('sendBtn');
const voiceMembersList  = $('voiceMembersList');
const voiceMemberCount  = $('voiceMemberCount');
const joinVoiceBtn  = $('joinVoiceBtn');
const leaveVoiceBtn = $('leaveVoiceBtn');
const voiceControls = $('voiceControls');
const voiceSelfAvatar = $('voiceSelfAvatar');
const voiceSelfName   = $('voiceSelfName');
const voiceSelfStatus = $('voiceSelfStatus');
const muteBtn       = $('muteBtn');
const reactionsGrid = $('reactionsGrid');
const reactionsFeed = $('reactionsFeed');
const syncBtn       = $('syncBtn');
const leaveRoomBtn  = $('leaveRoomBtn');
const closeBtn      = $('closeBtn');

// ── Panel toggle ──────────────────────────────────────────
toggleTab.addEventListener('click', () => {
  state.panelOpen = !state.panelOpen;
  panel.classList.toggle('hidden', !state.panelOpen);
  // Remove toggle when open (panel covers that edge)
  toggleTab.style.opacity = state.panelOpen ? '0' : '1';
  toggleTab.style.pointerEvents = state.panelOpen ? 'none' : 'all';
});

closeBtn.addEventListener('click', () => {
  state.panelOpen = false;
  panel.classList.add('hidden');
  toggleTab.style.opacity = '1';
  toggleTab.style.pointerEvents = 'all';
});

// ── Tab switching ─────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${tab}`).classList.add('active');
    if (tab === 'chat') scrollToBottom();
  });
});

// ── Message from content script ───────────────────────────
window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const msg = event.data;
  if (!msg?.type) return;

  switch (msg.type) {
    case 'INIT':
      state.user = msg.user;
      state.roomId = msg.roomId;
      state.platform = msg.platform;
      state.platformColor = msg.platformColor;
      platformName.textContent = msg.platform || 'Streaming';
      if (msg.user) {
        voiceSelfName.textContent = msg.user.displayName;
        voiceSelfAvatar.src = msg.user.avatar || '';
      }
      break;

    case 'STATUS':
      state.connected = msg.status === 'connected';
      connDot.classList.toggle('connected', state.connected);
      connDot.title = state.connected ? 'Connected' : 'Disconnected';
      break;

    case 'ROOM_JOINED':
      state.members = msg.members || [];
      state.messages = msg.chatHistory || [];
      renderMembersStrip();
      renderAllMessages();
      if (msg.videoState) {} // state handled by content script
      break;

    case 'MEMBER_JOINED':
      if (!state.members.find((m) => m.userId === msg.member.userId)) {
        state.members.push(msg.member);
        renderMembersStrip();
        appendSystemMsg(`${msg.member.displayName} joined`);
      }
      break;

    case 'MEMBER_LEFT':
      state.members = state.members.filter((m) => m.userId !== msg.userId);
      renderMembersStrip();
      appendSystemMsg(`${msg.displayName} left`);
      break;

    case 'CHAT_MESSAGE':
      state.messages.push(msg.message);
      appendMessage(msg.message);
      break;

    case 'CHAT_TYPING':
      handleTypingIndicator(msg.userId, msg.displayName, msg.isTyping);
      break;

    case 'CHAT_REACTION':
      applyReaction(msg.messageId, msg.emoji, msg.userId);
      break;

    case 'VIDEO_ACTION':
      appendSystemMsg(
        msg.action === 'play' ? '▶ Someone pressed play'
        : msg.action === 'pause' ? '⏸ Someone paused'
        : '⟳ Video synced'
      );
      break;

    case 'VOICE_JOINED':
      if (!state.voiceMembers.find((m) => m.userId === msg.userId)) {
        state.voiceMembers.push({ userId: msg.userId, displayName: msg.displayName, avatar: msg.avatar, isMuted: false });
        renderVoiceMembers();
      }
      // Initiate WebRTC connection if we're in voice
      if (state.inVoice && msg.userId !== state.user?.userId) {
        createPeer(msg.userId, true);
      }
      break;

    case 'VOICE_LEFT':
      state.voiceMembers = state.voiceMembers.filter((m) => m.userId !== msg.userId);
      destroyPeer(msg.userId);
      renderVoiceMembers();
      break;

    case 'VOICE_MUTED':
      state.voiceMembers = state.voiceMembers.map((m) =>
        m.userId === msg.userId ? { ...m, isMuted: msg.isMuted } : m
      );
      renderVoiceMembers();
      break;

    case 'VOICE_OFFER':
      handleVoiceOffer(msg.fromId, msg.sdp);
      break;

    case 'VOICE_ANSWER':
      handleVoiceAnswer(msg.fromId, msg.sdp);
      break;

    case 'VOICE_ICE':
      handleIceCandidate(msg.fromId, msg.candidate);
      break;

    case 'ERROR':
      appendSystemMsg(`⚠️ ${msg.message}`, 'error');
      break;
  }
});

// ── Send to content script ────────────────────────────────
function send(type, payload = {}) {
  window.parent.postMessage({ type, payload }, '*');
}

// ── Chat ──────────────────────────────────────────────────
function renderAllMessages() {
  messagesList.innerHTML = '';
  if (state.messages.length === 0) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>No messages yet</p>
        <p class="empty-sub">Be the first to say something!</p>
      </div>`;
    return;
  }
  state.messages.forEach((msg) => appendMessage(msg, false));
  scrollToBottom();
}

function appendMessage(msg, scroll = true) {
  // Remove empty state
  const empty = messagesList.querySelector('.empty-state');
  if (empty) empty.remove();

  const isSelf = msg.userId === state.user?.userId;
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const group = document.createElement('div');
  group.className = 'msg-group';
  group.dataset.msgId = msg.id;

  const reactions = buildReactionChips(msg.id, msg.reactions || {});

  group.innerHTML = `
    <div class="msg-meta ${isSelf ? 'justify-end' : ''}" style="${isSelf ? 'flex-direction:row-reverse' : ''}">
      <img class="msg-avatar" src="${msg.avatar || ''}" onerror="this.style.display='none'" />
      <span class="msg-author">${msg.displayName}</span>
      <span class="msg-time">${time}</span>
    </div>
    <div class="msg-row ${isSelf ? 'self' : ''}">
      <div class="msg-bubble ${isSelf ? 'self' : 'other'}">
        ${escapeHtml(msg.content)}
        <div class="msg-react-trigger">
          ${QUICK_REACTIONS.slice(0, 6).map((e) => `<span data-emoji="${e}" data-msg-id="${msg.id}">${e}</span>`).join('')}
        </div>
      </div>
    </div>
    ${reactions ? `<div class="msg-reactions" id="reactions-${msg.id}">${reactions}</div>` : `<div class="msg-reactions" id="reactions-${msg.id}"></div>`}`;

  // Reaction click handlers
  group.querySelectorAll('.msg-react-trigger span').forEach((el) => {
    el.addEventListener('click', () => {
      send('CHAT_REACT', { messageId: el.dataset.msgId, emoji: el.dataset.emoji });
    });
  });
  group.querySelectorAll('.reaction-chip').forEach(bindReactionChip);

  messagesList.appendChild(group);
  if (scroll) scrollToBottom();
}

function appendSystemMsg(text, type = 'info') {
  const el = document.createElement('div');
  el.style.cssText = `text-align:center;font-size:11px;color:var(--dim);padding:4px 0;animation:fadeSlide 0.2s ease-out;`;
  el.textContent = text;
  messagesList.appendChild(el);
  scrollToBottom();
}

function buildReactionChips(msgId, reactions) {
  return Object.entries(reactions)
    .filter(([, users]) => users.length > 0)
    .map(([emoji, users]) => {
      const mine = users.includes(state.user?.userId);
      return `<span class="reaction-chip ${mine ? 'mine' : ''}" data-emoji="${emoji}" data-msg-id="${msgId}">
        ${emoji} <span>${users.length}</span>
      </span>`;
    }).join('');
}

function applyReaction(msgId, emoji, userId) {
  const msg = state.messages.find((m) => m.id === msgId);
  if (!msg) return;
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const idx = msg.reactions[emoji].indexOf(userId);
  if (idx >= 0) msg.reactions[emoji].splice(idx, 1);
  else msg.reactions[emoji].push(userId);

  const container = document.getElementById(`reactions-${msgId}`);
  if (container) {
    container.innerHTML = buildReactionChips(msgId, msg.reactions);
    container.querySelectorAll('.reaction-chip').forEach(bindReactionChip);
  }
}

function bindReactionChip(el) {
  el.addEventListener('click', () => {
    send('CHAT_REACT', { messageId: el.dataset.msgId, emoji: el.dataset.emoji });
  });
}

function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

// ── Typing ────────────────────────────────────────────────
let typingTimeout = null;
let isTyping = false;

chatInput.addEventListener('input', () => {
  if (!isTyping) {
    isTyping = true;
    send('CHAT_TYPING', { isTyping: true });
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    send('CHAT_TYPING', { isTyping: false });
  }, 2000);

  // Auto resize
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitChat();
  }
});

sendBtn.addEventListener('click', submitChat);

function submitChat() {
  const content = chatInput.value.trim();
  if (!content) return;
  send('CHAT_SEND', { content });
  chatInput.value = '';
  chatInput.style.height = 'auto';
  clearTimeout(typingTimeout);
  isTyping = false;
  send('CHAT_TYPING', { isTyping: false });
}

function handleTypingIndicator(userId, displayName, typing) {
  if (typing) {
    state.typingUsers[userId] = displayName;
  } else {
    delete state.typingUsers[userId];
  }
  const names = Object.values(state.typingUsers);
  if (names.length === 0) {
    typingBar.innerHTML = '';
  } else {
    const label = names.length === 1 ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(', ')} are typing`;
    typingBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        ${label}
      </div>`;
  }
}

// ── Members strip ─────────────────────────────────────────
function renderMembersStrip() {
  if (state.members.length === 0) {
    membersStrip.innerHTML = `<span class="members-empty">No members yet</span>`;
    return;
  }
  membersStrip.innerHTML = state.members.map((m) => {
    const isSelf = m.userId === state.user?.userId;
    return `
      <div class="member-chip ${isSelf ? 'self' : ''}" title="${m.displayName}">
        <img class="member-chip-avatar" src="${m.avatar || ''}" onerror="this.style.display='none'" />
        <span class="member-chip-name">${m.displayName}</span>
      </div>`;
  }).join('');
}

// ── Voice members ─────────────────────────────────────────
function renderVoiceMembers() {
  voiceMemberCount.textContent = state.voiceMembers.length;
  if (state.voiceMembers.length === 0) {
    voiceMembersList.innerHTML = `<p class="voice-empty">No one in voice yet</p>`;
    return;
  }
  voiceMembersList.innerHTML = state.voiceMembers.map((m) => `
    <div class="voice-member-row">
      <img class="voice-member-avatar" src="${m.avatar || ''}" onerror="this.style.display='none'" />
      <span class="voice-member-name">${m.displayName}${m.userId === state.user?.userId ? ' (you)' : ''}</span>
      <span class="voice-member-muted">${m.isMuted ? '🔇' : '🎙️'}</span>
    </div>`).join('');
}

// ── Voice actions ─────────────────────────────────────────
joinVoiceBtn.addEventListener('click', async () => {
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.inVoice = true;
    state.isMuted = false;
    send('VOICE_JOIN', { channelId: 'general' });
    joinVoiceBtn.classList.add('hidden');
    leaveVoiceBtn.classList.remove('hidden');
    voiceControls.classList.remove('hidden');
    updateMuteUI();
  } catch (err) {
    appendSystemMsg('⚠️ Microphone permission denied', 'error');
  }
});

leaveVoiceBtn.addEventListener('click', () => {
  leaveVoice();
});

function leaveVoice() {
  send('VOICE_LEAVE', { channelId: 'general' });
  state.inVoice = false;
  state.localStream?.getTracks().forEach((t) => t.stop());
  state.localStream = null;
  Object.keys(state.peers).forEach(destroyPeer);
  joinVoiceBtn.classList.remove('hidden');
  leaveVoiceBtn.classList.add('hidden');
  voiceControls.classList.add('hidden');
}

muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  state.localStream?.getAudioTracks().forEach((t) => { t.enabled = !state.isMuted; });
  send('VOICE_MUTE', { isMuted: state.isMuted });
  updateMuteUI();
});

function updateMuteUI() {
  muteBtn.textContent = state.isMuted ? '🔇' : '🎙️';
  muteBtn.classList.toggle('muted', state.isMuted);
  voiceSelfStatus.textContent = state.isMuted ? 'Muted' : 'Speaking';
  voiceSelfStatus.classList.toggle('muted', state.isMuted);
}

// ── WebRTC peer management ────────────────────────────────
function createPeer(remoteUserId, initiator) {
  if (state.peers[remoteUserId]) return state.peers[remoteUserId];

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  state.peers[remoteUserId] = pc;

  // Add local tracks
  state.localStream?.getTracks().forEach((track) => {
    pc.addTrack(track, state.localStream);
  });

  // ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) send('VOICE_ICE', { targetId: remoteUserId, candidate });
  };

  // Remote audio
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (!state.audioEls[remoteUserId]) {
      const audio = new Audio();
      audio.autoplay = true;
      document.body.appendChild(audio);
      state.audioEls[remoteUserId] = audio;
    }
    state.audioEls[remoteUserId].srcObject = stream;
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      destroyPeer(remoteUserId);
    }
  };

  if (initiator) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => send('VOICE_OFFER', { targetId: remoteUserId, sdp: pc.localDescription }))
      .catch(console.error);
  }

  return pc;
}

async function handleVoiceOffer(fromId, sdp) {
  if (!state.inVoice) return;
  let pc = state.peers[fromId] || createPeer(fromId, false);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send('VOICE_ANSWER', { targetId: fromId, sdp: pc.localDescription });
}

async function handleVoiceAnswer(fromId, sdp) {
  const pc = state.peers[fromId];
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
}

async function handleIceCandidate(fromId, candidate) {
  const pc = state.peers[fromId];
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('[WatchParty] ICE error', e);
  }
}

function destroyPeer(userId) {
  state.peers[userId]?.close();
  delete state.peers[userId];
  if (state.audioEls[userId]) {
    state.audioEls[userId].srcObject = null;
    state.audioEls[userId].remove();
    delete state.audioEls[userId];
  }
}

// ── Reactions grid ────────────────────────────────────────
QUICK_REACTIONS.forEach((emoji) => {
  const btn = document.createElement('button');
  btn.className = 'reaction-btn';
  btn.textContent = emoji;
  btn.addEventListener('click', () => {
    send('CHAT_REACT', { messageId: '__global__', emoji });
    addReactionFeedItem(emoji, state.user?.displayName || 'You');
  });
  reactionsGrid.appendChild(btn);
});

function addReactionFeedItem(emoji, name) {
  const item = document.createElement('div');
  item.className = 'reaction-feed-item';
  item.innerHTML = `<span class="reaction-feed-emoji">${emoji}</span><span>${name}</span>`;
  reactionsFeed.prepend(item);
  state.reactionFeed.push({ emoji, name });
  if (reactionsFeed.children.length > 10) {
    reactionsFeed.lastChild?.remove();
  }
}

// ── Footer buttons ────────────────────────────────────────
syncBtn.addEventListener('click', () => {
  send('SYNC_REQUEST');
  appendSystemMsg('⟳ Syncing...');
});

leaveRoomBtn.addEventListener('click', () => {
  if (state.inVoice) leaveVoice();
  send('LEAVE_ROOM');
});

// ── Helpers ───────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Ready ─────────────────────────────────────────────────
renderMembersStrip();
renderVoiceMembers();