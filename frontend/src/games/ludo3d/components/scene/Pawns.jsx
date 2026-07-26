import { useRef, useEffect } from 'react';
import { COLOR_HEX } from '@/components/games/board-layout.js';
import Pawn from './Pawn.jsx';

function PawnMount({ tokenId, registerPawnRef, ...pawnProps }) {
  const ref = useRef(null);
  useEffect(() => {
    registerPawnRef(tokenId, ref.current);
    return () => registerPawnRef(tokenId, null);
  }, [tokenId, registerPawnRef]);
  return <Pawn ref={ref} {...pawnProps} />;
}

/**
 * Renders every seated player's 4 tokens and registers each one's
 * imperative animation handle with the controller (registerPawnRef), so
 * the controller can address a specific token by id when replaying engine
 * events (hop-move, capture-tumble) -- see state/useLudo3DStore.js.
 */
export default function Pawns({ seats, tokens, highlightableTokenIds, onTokenClick, registerPawnRef }) {
  return seats.flatMap((seat) =>
    [0, 1, 2, 3].map((tokenIndex) => {
      const tokenId = `${seat.color}-${tokenIndex}`;
      const token = tokens[tokenId];
      if (!token) return null;
      const isHighlighted = highlightableTokenIds.includes(tokenId);
      return (
        <PawnMount
          key={tokenId}
          tokenId={tokenId}
          registerPawnRef={registerPawnRef}
          color={seat.color}
          colorHex={COLOR_HEX[seat.color]}
          tokenIndex={tokenIndex}
          initialPos={token.pos}
          isHighlighted={isHighlighted}
          onClick={isHighlighted ? (e) => { e.stopPropagation(); onTokenClick(tokenId); } : undefined}
        />
      );
    })
  );
}
