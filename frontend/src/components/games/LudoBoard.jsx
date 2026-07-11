import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  TRACK, HOME_STRETCH, SAFE_GLOBAL_SQUARES, BASE_TOP_LEFT, COLOR_HEX, tokenCell,
} from './board-layout.js';

export default function LudoBoard() {
  const { gameState, room, members } = useRoomStore();
  const { startGame, sendGameAction } = useRoomActions();
  const { user } = useAuth();

  const isHost = room?.hostId === user?.userId;
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];
  const isMyTurn = !!currentPlayer && currentPlayer.userId === user?.userId;
  const legalTokenIds = gameState?.legalTokenIds || [];

  const handleRoll = () => sendGameAction({ type: 'roll_dice' });
  const handleMove = (tokenId) => sendGameAction({ type: 'move_token', tokenId });

  if (!gameState) {
    return (
      <div className="w-full h-full flex items-center justify-center px-6">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl">🎲</div>
          <p className="text-bright text-sm font-medium">Ludo hasn't started yet</p>
          <p className="text-dim text-xs">
            {members.length} player{members.length !== 1 ? 's' : ''} in the room — needs 2 to 4
          </p>
          {isHost ? (
            <button
              onClick={startGame}
              disabled={members.length < 2 || members.length > 4}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {members.length < 2 ? 'Waiting for more players...' : 'Start Game →'}
            </button>
          ) : (
            <p className="text-dim text-xs">Waiting for the host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
      {/* Turn / player indicator */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {gameState.players.map((p, i) => (
          <div
            key={p.userId}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                        ${i === gameState.currentPlayerIndex ? 'border-amber shadow-glow-sm scale-105' : 'border-border opacity-70'}`}
            style={{ color: COLOR_HEX[p.color] }}
          >
            {p.displayName}
          </div>
        ))}
      </div>

      {/* Board */}
      <svg viewBox="0 0 15 15" className="w-full max-w-[480px] aspect-square shrink-0">
        <rect x={0} y={0} width={15} height={15} fill="#080a0f" />

        {Object.entries(BASE_TOP_LEFT).map(([color, [r, c]]) => (
          <rect key={color} x={c} y={r} width={6} height={6}
                fill={`${COLOR_HEX[color]}18`} stroke={COLOR_HEX[color]} strokeWidth={0.06} rx={0.3} />
        ))}

        {TRACK.map(([r, c], i) => (
          <rect key={`t${i}`} x={c} y={r} width={1} height={1} fill="#141820" stroke="#1e2433" strokeWidth={0.02} />
        ))}

        {SAFE_GLOBAL_SQUARES.map((g) => {
          const [r, c] = TRACK[g];
          return <circle key={`s${g}`} cx={c + 0.5} cy={r + 0.5} r={0.12} fill="#f5a623" opacity={0.6} />;
        })}

        {Object.entries(HOME_STRETCH).map(([color, cells]) =>
          cells.map(([r, c], i) => (
            <rect key={`${color}-${i}`} x={c} y={r} width={1} height={1}
                  fill={`${COLOR_HEX[color]}33`} stroke={COLOR_HEX[color]} strokeWidth={0.02} />
          ))
        )}

        <rect x={6} y={6} width={3} height={3} fill="#f5a62322" stroke="#f5a623" strokeWidth={0.06} />

        {Object.entries(gameState.tokens).map(([tokenId, token]) => {
          const tokenIndex = parseInt(tokenId.split('-')[1], 10);
          const [r, c] = tokenCell(token.color, token.pos, tokenIndex);
          const clickable = isMyTurn && legalTokenIds.includes(tokenId);
          return (
            <circle
              key={tokenId}
              cx={c + 0.5}
              cy={r + 0.5}
              r={clickable ? 0.4 : 0.32}
              fill={COLOR_HEX[token.color]}
              stroke={clickable ? '#eef2fc' : '#00000055'}
              strokeWidth={clickable ? 0.07 : 0.025}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              className={clickable ? 'animate-pulse-dot' : ''}
              onClick={() => clickable && handleMove(tokenId)}
            />
          );
        })}
      </svg>

      {/* Dice + status */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-14 h-14 rounded-xl bg-raised border border-border
                         flex items-center justify-center text-2xl font-display font-bold text-bright">
          {gameState.diceValue ?? '—'}
        </div>
        {isMyTurn && gameState.diceValue === null && (
          <button onClick={handleRoll} className="btn-primary">🎲 Roll Dice</button>
        )}
        {isMyTurn && gameState.diceValue !== null && legalTokenIds.length > 0 && (
          <p className="text-sub text-sm">Tap a glowing token to move it</p>
        )}
        {!isMyTurn && !gameState.winner && (
          <p className="text-dim text-sm">Waiting for {currentPlayer?.displayName}...</p>
        )}
      </div>

      {/* Win banner */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 bg-void/85 flex items-center justify-center px-6">
          <div className="card p-8 text-center space-y-4 animate-slide-up">
            <div className="text-5xl">🏆</div>
            <p className="text-bright text-xl font-display font-bold">
              {gameState.players.find((p) => p.userId === gameState.winner)?.displayName} won!
            </p>
            {isHost && (
              <button onClick={startGame} className="btn-primary">
                Play Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
