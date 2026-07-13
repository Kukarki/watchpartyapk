import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/api/room.api.js';
import Avatar from '@/components/ui/Avatar.jsx';

function formatDate(iso) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function RoomHistoryModal({ roomId, onClose }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    roomApi.getRoomHistory(roomId)
      .then(({ history }) => { if (!cancelled) setDetail(history); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  const handleJoin = () => {
    onClose();
    navigate(`/room/${roomId}`);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-void/60" onClick={onClose} />
      <div className="fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       w-[92vw] max-w-md max-h-[80vh] card flex flex-col animate-fade-in">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <p className="text-sm font-semibold text-bright">Room history</p>
          <button type="button" onClick={onClose} className="text-dim hover:text-bright text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-dim text-xs py-6 justify-center">
              <span className="w-3 h-3 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
              Loading…
            </div>
          ) : error || !detail ? (
            <p className="text-dim text-sm py-6 text-center">Couldn't load this room's history.</p>
          ) : (
            <>
              <div>
                <h3 className="font-display font-semibold text-bright text-lg truncate">{detail.name}</h3>
                <p className="text-dim text-xs mt-0.5">
                  Hosted by {detail.hostName || 'Unknown'} · Created {formatDate(detail.createdAt)}
                </p>
                {detail.lastVideoUrl && (
                  <p className="text-dim text-xs mt-1 truncate">
                    Last playing: <span className="text-sub">{detail.lastVideoUrl}</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-dim mb-2">
                  {detail.participantCount} {detail.participantCount === 1 ? 'person' : 'people'} watched
                </p>
                <div className="space-y-1">
                  {detail.participants.map((p) => (
                    <div key={p.userId} className="flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-lg">
                      <Avatar src={p.avatar} name={p.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bright truncate">
                          {p.displayName}
                          {p.userId === detail.hostId && (
                            <span className="ml-1.5 text-[10px] text-amber font-mono uppercase tracking-widest">Host</span>
                          )}
                        </p>
                        {p.username && <p className="text-xs text-dim truncate">@{p.username}</p>}
                      </div>
                      <p className="text-xs text-dim shrink-0">{formatDate(p.joinedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && detail && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <button onClick={handleJoin} className="btn-primary w-full justify-center text-sm">
              Rejoin Room →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
