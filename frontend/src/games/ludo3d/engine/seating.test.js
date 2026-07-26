import { describe, it, expect } from 'vitest';
import { assignSeats } from './seating.js';

const DIAGONAL = { red: 'yellow', green: 'blue', yellow: 'red', blue: 'green' };
const ADJACENT = { red: ['green', 'blue'], green: ['red', 'yellow'], yellow: ['green', 'blue'], blue: ['red', 'yellow'] };

describe('assignSeats', () => {
  it('4 players: seats all four corners', () => {
    const seats = assignSeats(4, 'red');
    expect(seats.map((s) => s.color).sort()).toEqual(['blue', 'green', 'red', 'yellow']);
  });

  for (const human of ['red', 'green', 'yellow', 'blue']) {
    it(`2 players (human=${human}): seats the human with their diagonal opposite, never adjacent`, () => {
      const seats = assignSeats(2, human);
      const colors = seats.map((s) => s.color);
      expect(colors).toContain(human);
      expect(colors).toContain(DIAGONAL[human]);
      expect(colors).toHaveLength(2);
      for (const adj of ADJACENT[human]) expect(colors).not.toContain(adj);
    });
  }

  it('2 players: exactly one seat is human, the other is a bot', () => {
    const seats = assignSeats(2, 'red');
    expect(seats.filter((s) => s.isHuman)).toHaveLength(1);
    expect(seats.filter((s) => s.isBot)).toHaveLength(1);
  });

  it('3 players: drops the human\'s diagonal opposite, keeps the human seated', () => {
    const seats = assignSeats(3, 'red');
    const colors = seats.map((s) => s.color);
    expect(colors).toHaveLength(3);
    expect(colors).toContain('red');
    expect(colors).not.toContain(DIAGONAL.red); // yellow dropped
  });

  it('rejects an invalid player count', () => {
    expect(() => assignSeats(1, 'red')).toThrow();
    expect(() => assignSeats(5, 'red')).toThrow();
  });
});
