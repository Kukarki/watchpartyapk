import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  TRACK, HOME_STRETCH, SAFE_GLOBAL_SQUARES, BASE_TOP_LEFT, COLOR_HEX, tokenCell,
} from './board-layout.js';

const ROLL_ANIM_MS = 650;

export default function LudoBoard({ isSolo = false }) {
  const { gameState, room, members } = useRoomStore();
  const { startGame, sendGameAction } = useRoomActions();
  const { user } = useAuth();

  // Solo games default to a full table of bots — the whole point of "solo"
  // is skipping the wait for a lobby to fill up.
  const [botCount, setBotCount] = useState(isSolo ? 3 : 0);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingFace, setRollingFace] = useState(1);
  const rollIntervalRef = useRef(null);
  const rollTimeoutRef = useRef(null);

  useEffect(() => () => {
    clearInterval(rollIntervalRef.current);
    clearTimeout(rollTimeoutRef.current);
  }, []);

  const isHost = room?.hostId === user?.userId;
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];
  const isMyTurn = !!currentPlayer && currentPlayer.userId === user?.userId;
  const legalTokenIds = gameState?.legalTokenIds || [];

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    sendGameAction({ type: 'roll_dice' });
    rollIntervalRef.current = setInterval(() => {
      setRollingFace(1 + Math.floor(Math.random() * 6));
    }, 90);
    rollTimeoutRef.current = setTimeout(() => {
      clearInterval(rollIntervalRef.current);
      setIsRolling(false);
    }, ROLL_ANIM_MS);
  };
  const handleMove = (tokenId) => sendGameAction({ type: 'move_token', tokenId });

  if (!gameState) {
    const maxBots = Math.max(0, 4 - members.length);
    const totalSeats = members.length + botCount;
    const canStart = totalSeats >= 2 && totalSeats <= 4;

    return (
      <div className="w-full h-full flex items-center justify-center px-6">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="text-6xl">{isSolo ? '🤖' : '🎲'}</div>
          <p className="text-bright text-sm font-medium">
            {isSolo ? 'Set up your solo match' : "Ludo hasn't started yet"}
          </p>
          {!isSolo && (
            <p className="text-dim text-xs">
              {members.length} player{members.length !== 1 ? 's' : ''} in the room — needs 2 to 4
            </p>
          )}

          {isHost && maxBots > 0 && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-dim text-xs">🤖 {isSolo ? 'Bots' : 'Add bots'}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBotCount((c) => Math.max(0, c - 1))}
                  disabled={botCount === 0}
                  className="w-7 h-7 rounded-lg bg-raised border border-border text-bright
                             disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="text-bright text-sm font-mono w-4 text-center">{botCount}</span>
                <button
                  onClick={() => setBotCount((c) => Math.min(maxBots, c + 1))}
                  disabled={botCount >= maxBots}
                  className="w-7 h-7 rounded-lg bg-raised border border-border text-bright
                             disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {isHost ? (
            <button
              onClick={() => startGame({ botCount })}
              disabled={!canStart}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {totalSeats < 2
                ? (isSolo ? 'Add at least 1 bot to start' : (members.length === 1 ? 'Add a bot to play solo, or wait for others' : 'Waiting for more players...'))
                : (isSolo ? 'Start Solo Game →' : 'Start Game →')}
            </button>
          ) : (
            <p className="text-dim text-xs">Waiting for the host to start the game...</p>
          )}
        </div>
      </div>
    );
  }

  const ownerByColor = Object.fromEntries(gameState.players.map((p) => [p.color, p]));

  return (
    <div className="relative w-full h-full flex flex-col items-center p-4 gap-3 overflow-y-auto">
      {/* Turn / player indicator */}
      <div className="flex items-center gap-2 flex-wrap justify-center shrink-0">
        {gameState.players.map((p, i) => (
          <div
            key={p.userId}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1
                        ${i === gameState.currentPlayerIndex ? 'border-amber shadow-glow-sm scale-105' : 'border-border opacity-70'}`}
            style={{ color: COLOR_HEX[p.color] }}
          >
            {p.isBot && <span title="Bot player">🤖</span>}
            {p.displayName}
          </div>
        ))}
      </div>

      {/* Dice + status — kept above the board so it's never scrolled out of view */}
      <div className="flex items-center gap-4 shrink-0">
        <div className={`w-14 h-14 rounded-xl bg-raised border border-border
                         flex items-center justify-center text-2xl font-display font-bold text-bright
                         ${isRolling ? 'animate-bounce' : ''}`}>
          {isRolling ? rollingFace : (gameState.diceValue ?? '—')}
        </div>
        {isMyTurn && !isRolling && gameState.diceValue === null && (
          <button onClick={handleRoll} className="btn-primary">🎲 Roll Dice</button>
        )}
        {isMyTurn && isRolling && (
          <p className="text-sub text-sm">Rolling…</p>
        )}
        {isMyTurn && !isRolling && gameState.diceValue !== null && legalTokenIds.length > 0 && (
          <p className="text-sub text-sm">Tap a glowing token to move it</p>
        )}
        {!isMyTurn && !gameState.winner && (
          <p className="text-dim text-sm flex items-center gap-1">
            {currentPlayer?.isBot && '🤖'} Waiting for {currentPlayer?.displayName}...
          </p>
        )}
      </div>

      {/* Board */}
      <svg viewBox="0 0 15 15" className="w-full max-w-[480px] aspect-square shrink-0">
        <rect x={0} y={0} width={15} height={15} fill="#080a0f" />

        {Object.entries(BASE_TOP_LEFT).map(([color, [r, c]]) => {
          const owner = ownerByColor[color];
          return (
            <g key={color}>
              <rect x={c} y={r} width={6} height={6}
                    fill={`${COLOR_HEX[color]}18`} stroke={COLOR_HEX[color]} strokeWidth={0.06} rx={0.3} />
              {/* 4 empty token sockets so the base always reads as "4 slots" even before pieces render */}
              {[[1, 1], [1, 4], [4, 1], [4, 4]].map(([dr, dc], i) => (
                <circle key={i} cx={c + dc + 0.5} cy={r + dr + 0.5} r={0.34}
                        fill="none" stroke={`${COLOR_HEX[color]}55`} strokeWidth={0.03} strokeDasharray="0.08 0.06" />
              ))}
              {owner && (
                <text x={c + 3} y={r + 0.55} textAnchor="middle" fontSize={0.42}
                      fill={COLOR_HEX[color]} fontWeight="600">
                  {owner.isBot ? '🤖 ' : ''}{owner.displayName}
                </text>
              )}
            </g>
          );
        })}

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
          const clickable = isMyTurn && !isRolling && legalTokenIds.includes(tokenId);
          const atHome = token.pos === 'home';
          return (
            <circle
              key={tokenId}
              cx={c + 0.5}
              cy={r + 0.5}
              r={clickable ? 0.42 : atHome ? 0.36 : 0.32}
              fill={COLOR_HEX[token.color]}
              stroke={clickable ? '#eef2fc' : '#0a0c12'}
              strokeWidth={clickable ? 0.08 : 0.05}
              style={{ cursor: clickable ? 'pointer' : 'default', transition: 'cx 0.25s ease, cy 0.25s ease' }}
              className={clickable ? 'animate-pulse-dot' : ''}
              onClick={() => clickable && handleMove(tokenId)}
            />
          );
        })}
      </svg>

      {/* Win banner */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 bg-void/85 flex items-center justify-center px-6">
          <div className="card p-8 text-center space-y-4 animate-slide-up">
            <div className="text-5xl">🏆</div>
            <p className="text-bright text-xl font-display font-bold flex items-center justify-center gap-1.5">
              {gameState.players.find((p) => p.userId === gameState.winner)?.isBot && '🤖'}
              {gameState.players.find((p) => p.userId === gameState.winner)?.displayName} won!
            </p>
            {isHost && (
              <button onClick={() => startGame({ botCount })} className="btn-primary">
                Play Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
