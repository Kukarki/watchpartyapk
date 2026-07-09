import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import Avatar from '@/components/ui/Avatar.jsx';
import { friendApi } from '@/api/friend.api.js';
import { useFriendsStore } from '@/store/friendsStore.js';
import { useFriends } from '@/contexts/FriendsContext.jsx';
import AppShell from '@/components/layout/AppShell.jsx';

const TABS = [
  { id: 'friends',  label: 'Friends',  icon: '👥' },
  { id: 'requests', label: 'Requests', icon: '✉️' },
  { id: 'add',      label: 'Add',      icon: '➕' },
];

function timeAgo(iso) {
  if (!iso) return 'a while ago';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function FriendsPage() {
  const { refetchFriends, refetchRequests } = useFriends();
  const { friends, incomingRequests, outgoingRequests, onlineFriendIds } = useFriendsStore();
  const [tab, setTab] = useState('friends');

  const onlineSet = new Set(onlineFriendIds);
  const sortedFriends = [...friends].sort((a, b) => Number(onlineSet.has(b.userId)) - Number(onlineSet.has(a.userId)));
  const onlineCount = friends.filter((f) => onlineSet.has(f.userId)).length;

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-8 animate-slide-up">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-bright mb-1">Friends</h1>
            <p className="text-sub text-sm flex items-center gap-2">
              {friends.length} friend{friends.length !== 1 ? 's' : ''}
              {onlineCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-online text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse-dot" />
                  {onlineCount} online
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 card p-1 w-fit">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = t.id === 'requests' ? incomingRequests.length : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                            flex items-center gap-1.5
                            ${active ? 'bg-amber text-void shadow-glow-sm' : 'text-sub hover:text-bright hover:bg-raised'}`}
              >
                <span className="text-xs">{t.icon}</span>
                {t.label}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger
                                     text-[10px] font-bold text-white flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'friends' && (
          <FriendsTab friends={sortedFriends} onlineSet={onlineSet} onChanged={refetchFriends} onAdd={() => setTab('add')} />
        )}
        {tab === 'requests' && (
          <RequestsTab
            incoming={incomingRequests}
            outgoing={outgoingRequests}
            onChanged={() => { refetchRequests(); refetchFriends(); }}
          />
        )}
        {tab === 'add' && <AddTab onChanged={refetchRequests} />}
      </main>
    </AppShell>
  );
}

// ── Friends ──────────────────────────────────────────────────────────────

function FriendsTab({ friends, onlineSet, onChanged, onAdd }) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) =>
      f.displayName?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q)
    );
  }, [friends, query]);

  const handleRemove = async (friendId, displayName) => {
    try {
      await friendApi.remove(friendId);
      toast.success(`Removed ${displayName}`);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove friend');
    }
  };

  if (friends.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center text-2xl">
          👋
        </div>
        <div>
          <p className="text-bright text-sm font-medium mb-1">No friends yet</p>
          <p className="text-dim text-xs">Search by username, name, or email to send your first request.</p>
        </div>
        <button type="button" onClick={onAdd} className="btn-primary text-xs px-4 py-2 mt-1">
          Add a Friend
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {friends.length > 6 && (
        <input
          type="text"
          className="input-base text-sm"
          placeholder="Filter your friends…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {visible.length === 0 ? (
        <p className="text-sub text-sm px-1">No friends match "{query}".</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((f) => {
            const online = onlineSet.has(f.userId);
            return (
              <div
                key={f.userId}
                className="card p-4 flex items-center gap-3 group hover:border-amber/25 transition-colors duration-200"
              >
                <div className="relative shrink-0">
                  <Avatar src={f.avatar} name={f.displayName} size="md" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface
                                ${online ? 'bg-online' : 'bg-dim'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bright font-medium truncate">{f.displayName}</p>
                  <p className="text-xs text-dim truncate">
                    {f.username && <span className="font-mono">@{f.username}</span>}
                    {f.username && ' · '}
                    <span className={online ? 'text-online' : ''}>
                      {online ? 'Online now' : `Last seen ${timeAgo(f.lastSeenAt)}`}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(f.userId, f.displayName)}
                  title="Remove friend"
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-dim
                             opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10
                             transition-all duration-150"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────

function RequestsTab({ incoming, outgoing, onChanged }) {
  const handleRespond = async (requestId, action) => {
    try {
      await friendApi.respond(requestId, action);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to respond to request');
    }
  };

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-raised border border-border flex items-center justify-center text-2xl">
          ✉️
        </div>
        <div>
          <p className="text-bright text-sm font-medium mb-1">No pending requests</p>
          <p className="text-dim text-xs">Requests you send or receive will show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section>
          <SectionLabel label="Incoming" count={incoming.length} />
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.requestId} className="card p-3.5 flex items-center gap-3">
                <Avatar src={r.avatar} name={r.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bright font-medium truncate">{r.displayName}</p>
                  <p className="text-xs text-dim truncate">
                    {r.username && <span className="font-mono">@{r.username} · </span>}
                    wants to be friends
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRespond(r.requestId, 'accept')}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(r.requestId, 'decline')}
                  className="btn-ghost text-xs px-3 py-1.5 shrink-0"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <SectionLabel label="Outgoing" count={outgoing.length} />
          <div className="space-y-2">
            {outgoing.map((r) => (
              <div key={r.requestId} className="card p-3.5 flex items-center gap-3 opacity-80">
                <Avatar src={r.avatar} name={r.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bright truncate">{r.displayName}</p>
                  {r.username && <p className="text-xs text-dim font-mono truncate">@{r.username}</p>}
                </div>
                <span className="text-xs text-dim font-mono shrink-0 px-2 py-1 rounded-full bg-raised border border-border">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ label, count }) {
  return (
    <p className="text-xs font-mono text-dim uppercase tracking-widest mb-2 flex items-center gap-2">
      {label}
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-raised border border-border text-sub normal-case tracking-normal">
        {count}
      </span>
    </p>
  );
}

// ── Add ──────────────────────────────────────────────────────────────────

function AddTab({ onChanged }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState(new Set());

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { results } = await friendApi.search(q.trim());
      setResults(results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const handleAdd = async (toUserId, displayName) => {
    try {
      await friendApi.request({ toUserId });
      setSentTo((s) => new Set(s).add(toUserId));
      toast.success(`Request sent to ${displayName}`);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    }
  };

  const showIdle = query.trim().length < 2;

  return (
    <div>
      <div className="relative mb-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          className="input-base pl-9"
          placeholder="Search by username, name, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {showIdle && (
        <p className="text-dim text-xs px-1">Type at least 2 characters to search.</p>
      )}

      {!showIdle && searching && (
        <div className="flex items-center gap-2 text-sub text-sm px-1">
          <span className="w-3.5 h-3.5 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
          Searching…
        </div>
      )}

      {!showIdle && !searching && results.length === 0 && (
        <p className="text-sub text-sm px-1">No users found for "{query.trim()}".</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.userId} className="card p-3.5 flex items-center gap-3">
              <Avatar src={r.avatar} name={r.displayName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-bright font-medium truncate">{r.displayName}</p>
                {r.username && <p className="text-xs text-dim font-mono truncate">@{r.username}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleAdd(r.userId, r.displayName)}
                disabled={sentTo.has(r.userId)}
                className="btn-primary text-xs px-3 py-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sentTo.has(r.userId) ? '✓ Sent' : 'Add Friend'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
