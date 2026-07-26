// Corner assignment for 2/3/4 players. Diagonal pairs (confirmed from
// board-layout.js's BASE_TOP_LEFT: red [0,0] vs yellow [9,9], green [0,9]
// vs blue [9,0]) matter for the 2-player case, which must never seat
// players on adjacent corners.
const CORNER_ORDER = ['red', 'green', 'yellow', 'blue']; // clockwise
const DIAGONAL_OF = { red: 'yellow', green: 'blue', yellow: 'red', blue: 'green' };

/**
 * @param {2|3|4} playerCount
 * @param {'red'|'green'|'yellow'|'blue'} humanCorner
 */
export function assignSeats(playerCount, humanCorner = 'red') {
  let colors;
  if (playerCount === 4) {
    colors = CORNER_ORDER;
  } else if (playerCount === 2) {
    colors = [humanCorner, DIAGONAL_OF[humanCorner]];
  } else if (playerCount === 3) {
    // Drop the corner diagonally opposite the human -- spreads the 3 active
    // seats more evenly around the board than dropping an adjacent one.
    const drop = DIAGONAL_OF[humanCorner];
    colors = CORNER_ORDER.filter((c) => c !== drop);
  } else {
    throw new Error('Ludo needs 2-4 players');
  }

  const colorSet = new Set(colors);
  // Keep clockwise order regardless of which corners were dropped, so
  // currentSeatIndex walking the array proceeds clockwise around the table
  // with absent corners skipped -- same as passing dice around a real table.
  return CORNER_ORDER.filter((c) => colorSet.has(c)).map((color) => ({
    color,
    isHuman: color === humanCorner,
    isBot: color !== humanCorner,
    name: color === humanCorner ? 'You' : `Bot ${color[0].toUpperCase()}${color.slice(1)}`,
  }));
}
