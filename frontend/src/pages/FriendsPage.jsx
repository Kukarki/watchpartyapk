import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Avatar from '@/components/ui/Avatar.jsx';
import { friendApi } from '@/api/friend.api.js';
import { useFriendsStore } from '@/store/friendsStore.js';
import { useFriends } from '@/contexts/FriendsContext.jsx';
import AppShell from '@/components/layout/AppShell.jsx';

const TABS = ['Friends', 'Requests', 'Add'];

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
  const [tab, setTab] = useState(0);

  const onlineSet = new Set(onlineFriendIds);
  const sortedFriends = [...friends].sort((a, b) => Number(onlineSet.has(b.userId)) - Number(onlineSet.has(a.userId)));

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-8 animate-slide-up">
        <h1 className="font-display font-bold text-2xl text-bright mb-6">Friends</h1>

        <div className="flex gap-1 mb-6 card p-1 w-fit">
          {TABS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative
                          ${tab === i ? 'bg-amber text-void' : 'text-sub hover:text-bright'}`}
            >
              {label}
              {label === 'Requests' && incomingRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger
                                   text-[10px] font-bold text-white flex items-center justify-center">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <FriendsTab friends={sortedFriends} onlineSet={onlineSet} onChanged={refetchFriends} />
        )}
        {tab === 1 && (
          <RequestsTab
            incoming={incomingRequests}
            outgoing={outgoingRequests}
            onChanged={() => { refetchRequests(); refetchFriends(); }}
          />
        )}
        {tab === 2 && <AddTab onChanged={refetchRequests} />}
      </main>
    </AppShell>
  );
}

function FriendsTab({ friends, onlineSet, onChanged }) {
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
    return <p className="text-sub text-sm">No friends yet — add some from the "Add" tab.</p>;
  }

  return (
    <div className="card divide-y divide-border">
      {friends.map((f) => {
        const online = onlineSet.has(f.userId);
        return (
          <div key={f.userId} className="flex items-center gap-3 px-4 py-3">
            <div className="relative shrink-0">
              <Avatar src={f.avatar} name={f.displayName} size="sm" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface
                            ${online ? 'bg-online' : 'bg-dim'}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-bright truncate">{f.displayName}</p>
              <p className="text-xs text-dim">{online ? 'Online' : `Last seen ${timeAgo(f.lastSeenAt)}`}</p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(f.userId, f.displayName)}
              className="btn-ghost text-xs px-2.5 py-1.5 shrink-0"
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RequestsTab({ incoming, outgoing, onChanged }) {
  const handleRespond = async (requestId, action) => {
    try {
      await friendApi.respond(requestId, action);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to respond to request');
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-mono text-dim uppercase tracking-widest mb-2">
          Incoming ({incoming.length})
        </p>
        {incoming.length === 0 ? (
          <p className="text-sub text-sm">No incoming requests.</p>
        ) : (
          <div className="card divide-y divide-border">
            {incoming.map((r) => (
              <div key={r.requestId} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={r.avatar} name={r.displayName} size="sm" />
                <p className="flex-1 min-w-0 text-sm text-bright truncate">{r.displayName}</p>
                <button
                  type="button"
                  onClick={() => handleRespond(r.requestId, 'accept')}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(r.requestId, 'decline')}
                  className="btn-ghost text-xs px-3 py-1.5"
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="text-xs font-mono text-dim uppercase tracking-widest mb-2">
          Outgoing ({outgoing.length})
        </p>
        {outgoing.length === 0 ? (
          <p className="text-sub text-sm">No outgoing requests.</p>
        ) : (
          <div className="card divide-y divide-border">
            {outgoing.map((r) => (
              <div key={r.requestId} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={r.avatar} name={r.displayName} size="sm" />
                <p className="flex-1 min-w-0 text-sm text-bright truncate">{r.displayName}</p>
                <span className="text-xs text-dim shrink-0">Pending</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

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

  const handleAdd = async (toUserId) => {
    try {
      await friendApi.request({ toUserId });
      setSentTo((s) => new Set(s).add(toUserId));
      toast.success('Friend request sent');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    }
  };

  return (
    <div>
      <input
        type="text"
        className="input-base mb-4"
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching && <p className="text-sub text-sm">Searching…</p>}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sub text-sm">No users found.</p>
      )}

      {results.length > 0 && (
        <div className="card divide-y divide-border">
          {results.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={r.avatar} name={r.displayName} size="sm" />
              <p className="flex-1 min-w-0 text-sm text-bright truncate">{r.displayName}</p>
              <button
                type="button"
                onClick={() => handleAdd(r.userId)}
                disabled={sentTo.has(r.userId)}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sentTo.has(r.userId) ? 'Sent' : 'Add Friend'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
