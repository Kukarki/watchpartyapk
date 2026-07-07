import { useState, useEffect } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { pollApi } from '@/api/room.api.js';
import toast from 'react-hot-toast';

/**
 * Normalise a poll row from Supabase:
 *   poll.poll_options  → sorted array of { id, text, vote_count, position }
 *   poll.poll_votes    → [{ user_id, option_id }]
 *
 * Returns { ...poll, options (sorted), myVotedIdx }
 */
function normalisePoll(poll, userId) {
  if (!poll) return null;
  const options = [...(poll.poll_options ?? [])].sort((a, b) => a.position - b.position);
  const myVote  = (poll.poll_votes ?? []).find((v) => v.user_id === userId);
  const myVotedIdx = myVote
    ? options.findIndex((o) => o.id === myVote.option_id)
    : -1;
  return { ...poll, options, myVotedIdx };
}

export default function PollPanel({ roomId }) {
  const { room, members } = useRoomStore();
  const { user }          = useAuth();

  const [poll, setPoll]         = useState(null);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions]   = useState(['', '']);
  const [duration, setDuration] = useState(5);
  const [loading, setLoading]   = useState(false);

  // Check host two ways: server member flag (most reliable) OR room hostId match
  const myMember = members.find((m) => m.userId === user?.userId);
  const isHost   = myMember?.isHost === true || room?.hostId === user?.userId;

  // Derived from normalised poll
  const totalVotes = poll?.options.reduce((s, o) => s + (o.vote_count ?? 0), 0) ?? 0;
  const myVotedIdx = poll?.myVotedIdx ?? -1;

  // Load active poll on mount
  useEffect(() => {
    if (!roomId) return;
    pollApi.getActive(roomId)
      .then((d) => setPoll(normalisePoll(d.poll, user?.userId)))
      .catch(() => {});
  }, [roomId, user?.userId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const filtered = options.filter((o) => o.trim());
    if (!question.trim() || filtered.length < 2) {
      toast.error('Need a question and at least 2 options');
      return;
    }
    setLoading(true);
    try {
      const data = await pollApi.create(roomId, {
        question:        question.trim(),
        options:         filtered,
        durationMinutes: duration,
      });
      setPoll(normalisePoll(data.poll, user?.userId));
      setCreating(false);
      setQuestion(''); setOptions(['', '']);
      toast.success('Poll created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (idx) => {
    if (!poll || myVotedIdx === idx) return;
    try {
      const data = await pollApi.vote(roomId, poll.id, idx);
      setPoll(normalisePoll(data.poll, user?.userId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Vote failed');
    }
  };

  const handleEnd = async () => {
    if (!poll) return;
    try {
      await pollApi.end(roomId, poll.id);
      setPoll((p) => p ? { ...p, is_active: false } : p);
      toast.success('Poll ended');
    } catch {}
  };

  const addOption = () => {
    if (options.length < 6) setOptions((o) => [...o, '']);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                       border-b border-border shrink-0">
        <div>
          <p className="text-bright text-sm font-semibold">Polls</p>
          <p className="text-dim text-xs">Vote on what to watch</p>
        </div>
        {isHost && !creating && !poll?.is_active && (
          <button onClick={() => setCreating(true)}
                  className="btn-primary text-xs px-3 py-1.5">
            + Create Poll
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* Create form */}
        {creating && (
          <form onSubmit={handleCreate} className="space-y-4 mb-4">
            <div>
              <label className="block text-sub text-xs font-mono uppercase
                                 tracking-widest mb-2">Question</label>
              <input
                className="input-base text-sm"
                placeholder="What should we watch next?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sub text-xs font-mono uppercase tracking-widest">
                Options
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input-base text-sm flex-1"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions((o) => o.filter((_, i) => i !== idx))}
                      className="text-dim hover:text-danger transition-colors text-sm px-2">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="btn-ghost text-xs w-full justify-center border border-dashed border-border">
                  + Add Option
                </button>
              )}
            </div>

            <div>
              <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-2">
                Duration: {duration} min
              </label>
              <input
                type="range" min={1} max={30} value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 justify-center text-sm disabled:opacity-40">
                {loading ? 'Creating...' : 'Start Poll'}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="btn-ghost border border-border text-sm px-4">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Active / ended poll */}
        {poll && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${
              poll.is_active ? 'border-amber/30 bg-amber/5' : 'border-border bg-raised'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-bright text-sm font-semibold leading-tight">
                    {poll.question}
                  </p>
                  <p className="text-dim text-xs mt-1">
                    {poll.is_active ? '🟢 Active' : '🔴 Ended'} · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                  </p>
                </div>
                {isHost && poll.is_active && (
                  <button
                    onClick={handleEnd}
                    className="btn-ghost text-xs px-3 py-1.5 border border-danger/30
                                text-danger hover:bg-danger/10 shrink-0">
                    End
                  </button>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {(poll.options ?? []).map((opt, idx) => {
                  const count = opt.vote_count ?? 0;
                  const pct   = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                  const isMe  = myVotedIdx === idx;
                  const isTop = (poll.options ?? []).every((o) => count >= (o.vote_count ?? 0));

                  return (
                    <button
                      key={opt.id ?? idx}
                      onClick={() => poll.is_active && handleVote(idx)}
                      disabled={!poll.is_active}
                      className={`w-full text-left rounded-xl overflow-hidden border
                                   transition-all duration-200 relative
                                   ${isMe ? 'border-amber/60' : 'border-border hover:border-amber/30'}
                                   ${!poll.is_active ? 'cursor-default' : 'cursor-pointer'}`}>

                      {/* Progress bar fill */}
                      <div
                        className="absolute inset-0 rounded-xl transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: isMe
                            ? 'rgba(245,166,35,0.15)'
                            : 'rgba(255,255,255,0.03)',
                        }}
                      />

                      <div className="relative flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center
                                            justify-center text-[8px] shrink-0
                                            ${isMe
                                              ? 'border-amber bg-amber text-void'
                                              : 'border-border'}`}>
                            {isMe ? '✓' : ''}
                          </span>
                          <span className={`text-sm ${isMe ? 'text-amber font-medium' : 'text-base'}`}>
                            {opt.text}
                          </span>
                          {isTop && totalVotes > 0 && !poll.is_active && (
                            <span className="text-xs text-amber">👑</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-dim shrink-0">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!poll && !creating && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🗳️</div>
            <p className="text-sub text-sm font-medium mb-1">No active poll</p>
            <p className="text-dim text-xs">
              Click "+ Create Poll" above to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
