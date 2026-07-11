import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell.jsx';
import { roomApi } from '@/api/room.api.js';
import toast from 'react-hot-toast';

// Add new games here as they're built — one entry maps to one backend game
// module (backend/src/games/) and one frontend board component
// (frontend/src/components/games/), wired via GameRoomPage.jsx's registry.
const GAMES = [
  { id: 'ludo', name: 'Ludo', icon: '🎲', description: 'Classic 4-player board game — roll, race, capture, get home first.' },
];

export default function GamesPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(null); // game id currently being created

  const handleStartGame = async (game) => {
    setCreating(game.id);
    try {
      const { room } = await roomApi.createRoom({
        name: roomName.trim() || `${game.name} Night`,
        roomType: 'game',
        gameType: game.id,
      });
      navigate(`/game-room/${room.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create game room');
    } finally {
      setCreating(null);
    }
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10 animate-slide-up">
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-bright mb-2">
            <span className="text-gradient">Games</span> Night
          </h1>
          <p className="text-sub">Play together while you chat and hang out on voice.</p>
        </div>

        <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <label className="block text-sub text-xs font-mono uppercase tracking-widest mb-2">
            Room name <span className="text-dim normal-case">(optional)</span>
          </label>
          <input
            type="text"
            className="input-base max-w-sm"
            placeholder="Friday Game Night"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={50}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => handleStartGame(game)}
              disabled={creating === game.id}
              className="card p-6 text-left hover:border-amber/40 transition-all hover:-translate-y-0.5
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-3">{game.icon}</div>
              <h3 className="font-display font-semibold text-bright text-base mb-1">{game.name}</h3>
              <p className="text-dim text-xs leading-relaxed">{game.description}</p>
              <span className="text-amber text-xs mt-3 inline-flex items-center gap-1">
                {creating === game.id ? 'Starting...' : 'Play'}
                {creating !== game.id && <span>→</span>}
              </span>
            </button>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
