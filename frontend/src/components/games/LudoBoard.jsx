import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  TRACK, HOME_STRETCH, SAFE_GLOBAL_SQUARES, BASE_TOP_LEFT, COLOR_HEX, tokenCell,
} from './board-layout.js';

const ROLL_ANIM_MS = 650;

// Classic 6-face pip layouts on a 3x3 grid.
const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DiceFace({ value, rolling }) {
  const active = PIP_LAYOUT[value] || [];
  return (
    <div className={`w-14 h-14 rounded-xl bg-[#f4f6fa] shadow-inner grid grid-cols-3 grid-rows-3
                     gap-1 p-2 shrink-0 ${rolling ? 'animate-[spin_0.5s_linear_infinite]' : ''}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full ${active.includes(i) ? 'bg-[#141826]' : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
}

export default function LudoBoard({ isSolo = false }) {
  const { gameState, members } = useRoomStore();
  const { startGame, sendGameAction } = useRoomActions();
  const { user } = useAuth();

  // Solo games default to a full table of bots — the whole point of "solo"
  // is skipping the wait for a lobby to fill up.
  const [botCount, setBotCount] = useState(isSolo ? 3 : 0);
  const [mode, setMode] = useState('classic');
  const [isRolling, setIsRolling] = useState(false);
  const [rollingFace, setRollingFace] = useState(1);
  const [showValuePicker, setShowValuePicker] = useState(false);
  const rollIntervalRef = useRef(null);
  const rollTimeoutRef = useRef(null);

  useEffect(() => () => {
    clearInterval(rollIntervalRef.current);
    clearTimeout(rollTimeoutRef.current);
  }, []);

  // Board sizing: measure the actual container pixel size and set the SVG
  // to min(width, height) directly, instead of relying on CSS
  // height-percentage/aspect-ratio propagating correctly through an
  // arbitrary flexbox ancestor chain (which proved unreliable here).
  const boardWrapRef = useRef(null);
  const [boardSize, setBoardSize] = useState(320);
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const size = Math.max(120, Math.floor(Math.min(w, h)));
      setBoardSize(size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [gameState != null]);

  // Step-by-step token movement: the server sends the token's final position
  // directly, but a real Ludo piece hops one square at a time. Diff each
  // game:state update against the previous one and, for any token that
  // walked forward (home->N release and captured->home sends are instant
  // snaps, not walks), animate through every intermediate square instead of
  // letting it jump straight there.
  const prevTokensRef = useRef(null);
  const [animOverrides, setAnimOverrides] = useState({});
  const animTimersRef = useRef({});

  useEffect(() => () => {
    Object.values(animTimersRef.current).forEach(clearInterval);
  }, []);

  useEffect(() => {
    const newTokens = gameState?.tokens;
    if (!newTokens) return;
    const prevTokens = prevTokensRef.current;
    prevTokensRef.current = newTokens;
    if (!prevTokens) return; // first render — nothing to diff against yet

    for (const [tokenId, newTok] of Object.entries(newTokens)) {
      const prevTok = prevTokens[tokenId];
      if (!prevTok || prevTok.pos === newTok.pos) continue;

      const oldPos = prevTok.pos;
      const newPos = newTok.pos;
      const finalNumeric = newPos === 'finished' ? 57 : newPos;
      // Only a forward walk (numeric -> numeric/finished, strictly increasing)
      // animates step by step; leaving home or getting captured just snaps.
      if (typeof oldPos !== 'number' || typeof finalNumeric !== 'number' || finalNumeric <= oldPos) continue;

      clearInterval(animTimersRef.current[tokenId]);
      let step = oldPos;
      setAnimOverrides((prev) => ({ ...prev, [tokenId]: step }));
      animTimersRef.current[tokenId] = setInterval(() => {
        step += 1;
        if (step >= finalNumeric) {
          clearInterval(animTimersRef.current[tokenId]);
          delete animTimersRef.current[tokenId];
          setAnimOverrides((prev) => ({ ...prev, [tokenId]: newPos })); // land on the real final value
          setTimeout(() => {
            setAnimOverrides((prev) => {
              const next = { ...prev };
              delete next[tokenId];
              return next;
            });
          }, 220);
        } else {
          setAnimOverrides((prev) => ({ ...prev, [tokenId]: step }));
        }
      }, 180);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.tokens]);

  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex];
  const isMyTurn = !!currentPlayer && currentPlayer.userId === user?.userId;
  const legalTokenIds = gameState?.legalTokenIds || [];

  useEffect(() => {
    if (!isMyTurn || gameState?.diceValue !== null) setShowValuePicker(false);
  }, [isMyTurn, gameState?.diceValue]);

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
  const handleChooseValue = (value) => {
    setShowValuePicker(false);
    sendGameAction({ type: 'choose_dice_value', value });
  };
  const diceChoicesLeft = gameState?.diceChoicesRemaining?.[user?.userId] ?? 0;

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

          {/* Any player in the room can configure and start — not just the host */}
          {!isSolo && maxBots > 0 && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-dim text-xs">🤖 Bots</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBotCount((c) => Math.max(0, c - 1))}
                  disabled={botCount === 0}
                  className="w-7 h-7 rounded-lg bg-raised border border-border text-bright
                             disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="text-bright text-sm font-mono w-4 text-center">
                  {botCount === 0 ? 'None' : botCount}
                </span>
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
          {isSolo && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-dim text-xs">🤖 Bots</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBotCount((c) => Math.max(1, c - 1))}
                  disabled={botCount <= 1}
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

          {/* Mode choice */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setMode('classic')}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all
                ${mode === 'classic' ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}
            >
              🎲 Classic
            </button>
            <button
              onClick={() => setMode('power')}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all
                ${mode === 'power' ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-sub'}`}
            >
              ⚡ Power Play
            </button>
          </div>
          {mode === 'power' && (
            <p className="text-dim text-[11px] max-w-xs mx-auto leading-relaxed">
              Each player gets 2 chances during the whole game to directly declare the dice number they want,
              and a token that just captured is shielded until it moves again.
            </p>
          )}

          <button
            onClick={() => startGame({ botCount, mode })}
            disabled={!canStart}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {totalSeats < 2
              ? (isSolo ? 'Add at least 1 bot to start' : (members.length === 1 ? 'Add a bot to play solo, or wait for others' : 'Waiting for more players...'))
              : (isSolo ? 'Start Solo Game →' : 'Start Game →')}
          </button>
          {!isSolo && members.length >= 2 && (
            <p className="text-dim text-[11px]">Anyone in the room can start the game</p>
          )}
        </div>
      </div>
    );
  }

  const ownerByColor = Object.fromEntries(gameState.players.map((p) => [p.color, p]));
  const activeColor = currentPlayer?.color;

  // Two or more tokens can legally share one square (a safe/star square, or
  // two of the same color moving together) — without this they'd render
  // exactly on top of each other and only the last-drawn one would be
  // visible. Group tokens by their current display cell and fan out any
  // group of 2+ into a small cluster so every token stays visible and
  // clickable. Tokens still "at home" already have their own 4-slot layout
  // (each color's base), so they never collide here.
  const cellGroups = {};
  for (const [tokenId, token] of Object.entries(gameState.tokens)) {
    const tokenIndex = parseInt(tokenId.split('-')[1], 10);
    const displayPos = animOverrides[tokenId] !== undefined ? animOverrides[tokenId] : token.pos;
    const [r, c] = tokenCell(token.color, displayPos, tokenIndex);
    const key = `${r},${c}`;
    (cellGroups[key] ||= []).push(tokenId);
  }
  const STACK_OFFSETS = {
    1: [[0, 0]],
    2: [[-0.2, -0.2], [0.2, 0.2]],
    3: [[-0.22, -0.22], [0.22, -0.22], [0, 0.22]],
    4: [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]],
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center p-2 sm:p-4 gap-2 sm:gap-3 overflow-hidden">
      {gameState.mode === 'power' && (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-amber
                          bg-amber/10 border border-amber/20 rounded-full px-2.5 py-0.5">
          ⚡ Power Play
        </span>
      )}

      {/* Dice + status — kept above the board so it's never scrolled out of view */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center gap-4">
          <DiceFace value={isRolling ? rollingFace : (gameState.diceValue ?? 1)} rolling={isRolling} />

          {isMyTurn && !isRolling && gameState.diceValue === null && (
            <div className="flex items-center gap-2">
              <button onClick={handleRoll} className="btn-primary">🎲 Roll Dice</button>
              {gameState.mode === 'power' && diceChoicesLeft > 0 && (
                <button
                  onClick={() => setShowValuePicker((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber
                             text-amber bg-amber/10 hover:bg-amber/20 transition-all"
                >
                  🎯 Choose ({diceChoicesLeft} left)
                </button>
              )}
            </div>
          )}
          {isMyTurn && isRolling && (
            <p className="text-sub text-sm">Rolling…</p>
          )}
          {isMyTurn && !isRolling && gameState.diceValue !== null && legalTokenIds.length > 0 && (
            <p className="text-sub text-sm">Tap a blinking token to move it</p>
          )}
          {!isMyTurn && !gameState.winner && (
            <p className="text-dim text-sm flex items-center gap-1">
              {currentPlayer?.isBot && '🤖'} Waiting for {currentPlayer?.displayName}...
            </p>
          )}
        </div>

        {isMyTurn && showValuePicker && !isRolling && gameState.diceValue === null && (
          <div className="flex items-center gap-1.5 animate-fade-in">
            <span className="text-dim text-[11px] mr-1">Declare a number:</span>
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <button
                key={v}
                onClick={() => handleChooseValue(v)}
                className="w-7 h-7 rounded-lg bg-raised border border-border text-bright text-xs font-mono
                           hover:border-amber hover:text-amber transition-all"
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Board — sized to whichever is smaller, available width or height,
          so it never gets cut off on any screen (phone/tablet/laptop). */}
      <div ref={boardWrapRef} className="flex-1 min-h-0 w-full flex items-center justify-center">
        <svg viewBox="0 0 15 15" width={boardSize} height={boardSize}>
          <rect x={0} y={0} width={15} height={15} fill="#080a0f" />

          {Object.entries(BASE_TOP_LEFT).map(([color, [r, c]]) => {
            const owner = ownerByColor[color];
            const isTurn = color === activeColor;
            return (
              <g key={color}>
                <rect x={c} y={r} width={6} height={6}
                      fill={`${COLOR_HEX[color]}18`}
                      stroke={COLOR_HEX[color]} strokeWidth={isTurn ? 0.12 : 0.06} rx={0.3}
                      className={isTurn ? 'ludo-token-blink' : ''} />
                {/* 4 empty token sockets so the base always reads as "4 slots" even before pieces render */}
                {[[1, 1], [1, 4], [4, 1], [4, 4]].map(([dr, dc], i) => (
                  <circle key={i} cx={c + dc + 0.5} cy={r + dr + 0.5} r={0.34}
                          fill="none" stroke={`${COLOR_HEX[color]}55`} strokeWidth={0.03} strokeDasharray="0.08 0.06" />
                ))}
                {owner && (
                  <text x={c + 3} y={r + 0.55} textAnchor="middle" fontSize={0.4}
                        fill={COLOR_HEX[color]} fontWeight="700">
                    {isTurn ? '▶ ' : ''}{owner.isBot ? '🤖 ' : ''}{owner.displayName}
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
            const displayPos = animOverrides[tokenId] !== undefined ? animOverrides[tokenId] : token.pos;
            const [r, c] = tokenCell(token.color, displayPos, tokenIndex);
            const clickable = isMyTurn && !isRolling && legalTokenIds.includes(tokenId);
            const atHome = token.pos === 'home';

            const group = cellGroups[`${r},${c}`];
            const stackSize = Math.min(group.length, 4);
            const stackIdx = group.indexOf(tokenId);
            const [offR, offC] = STACK_OFFSETS[stackSize][stackIdx] || [0, 0];
            const cx = c + 0.5 + offC;
            const cy = r + 0.5 + offR;
            const radius = (atHome ? 0.36 : 0.32) * (stackSize > 1 ? 0.62 : 1);

            return (
              <g key={tokenId}>
                {token.shielded && (
                  <circle cx={cx} cy={cy} r={radius + 0.16}
                          fill="none" stroke="#f5a623" strokeWidth={0.05} strokeDasharray="0.1 0.05"
                          style={{ transition: 'cx 0.25s ease, cy 0.25s ease' }} />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={COLOR_HEX[token.color]}
                  stroke={clickable ? '#eef2fc' : '#0a0c12'}
                  strokeWidth={clickable ? 0.08 : 0.05}
                  style={{ cursor: clickable ? 'pointer' : 'default', transition: 'cx 0.25s ease, cy 0.25s ease' }}
                  className={clickable ? 'ludo-token-blink' : ''}
                  onClick={() => clickable && handleMove(tokenId)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Win banner */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 bg-void/85 flex items-center justify-center px-6">
          <div className="card p-8 text-center space-y-4 animate-slide-up">
            <div className="text-5xl">🏆</div>
            <p className="text-bright text-xl font-display font-bold flex items-center justify-center gap-1.5">
              {gameState.players.find((p) => p.userId === gameState.winner)?.isBot && '🤖'}
              {gameState.players.find((p) => p.userId === gameState.winner)?.displayName} won!
            </p>
            <button onClick={() => startGame({ botCount, mode })} className="btn-primary">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
