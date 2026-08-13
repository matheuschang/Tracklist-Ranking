import { describe, it, expect } from 'vitest';
import { boardReducer, initialState, rankScore, OVER_ZONE, type BoardState } from './boardReducer';
import type { ResolvedSource, Track } from '../providers/types';

function source(n: number): ResolvedSource {
  const tracks: Track[] = Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    title: `T${i}`,
    artist: '',
    artworkUrl: null,
    durationMs: null,
    index: i,
  }));
  return {
    ref: { provider: 'manual', kind: 'album', id: 'manual' },
    title: 'X',
    subtitle: '',
    artworkUrl: null,
    tracks,
  };
}

function loaded(n: number): BoardState {
  return boardReducer(initialState, { type: 'LOAD_SOURCE', source: source(n) });
}

/** Compact view: tier index per track, and the lane orders. */
function view(s: BoardState) {
  return { assignment: s.assignment, tierOrder: s.tierOrder, benchOrder: s.benchOrder };
}

describe('DROP — bench → tier', () => {
  it('moves a track from the bench into a tier (container target)', () => {
    let s = loaded(4);
    s = boardReducer(s, { type: 'DROP', track: 2, overId: 'tier-0' });
    expect(s.assignment[2]).toBe(0);
    expect(s.tierOrder[0]).toEqual([2]);
    expect(s.benchOrder).toEqual([0, 1, 3]);
  });

  it('appends when dropping on an empty tier container', () => {
    let s = loaded(3);
    s = boardReducer(s, { type: 'DROP', track: 0, overId: 'tier-2' });
    s = boardReducer(s, { type: 'DROP', track: 1, overId: 'tier-2' });
    expect(s.tierOrder[2]).toEqual([0, 1]); // source order preserved by append
  });
});

describe('DROP — before a card', () => {
  it('inserts before the target card in the same tier (reorder)', () => {
    let s = loaded(3);
    // put 0,1,2 all in tier 1 → order [0,1,2]
    s = boardReducer(s, { type: 'DROP', track: 0, overId: 'tier-1' });
    s = boardReducer(s, { type: 'DROP', track: 1, overId: 'tier-1' });
    s = boardReducer(s, { type: 'DROP', track: 2, overId: 'tier-1' });
    expect(s.tierOrder[1]).toEqual([0, 1, 2]);
    // drop track 2 before track 0 → [2,0,1]
    s = boardReducer(s, { type: 'DROP', track: 2, overId: 0 });
    expect(s.tierOrder[1]).toEqual([2, 0, 1]);
    expect(s.assignment[2]).toBe(1);
  });

  it('moves cross-tier, landing before the hovered card', () => {
    let s = loaded(4);
    s = boardReducer(s, { type: 'DROP', track: 1, overId: 'tier-3' });
    s = boardReducer(s, { type: 'DROP', track: 2, overId: 'tier-3' }); // tier3: [1,2]
    // drag bench track 0 onto card 2 → tier3 becomes [1,0,2]
    s = boardReducer(s, { type: 'DROP', track: 0, overId: 2 });
    expect(s.tierOrder[3]).toEqual([1, 0, 2]);
    expect(s.assignment[0]).toBe(3);
  });
});

describe('DROP — back to the bench', () => {
  it('returns a ranked track to the bench', () => {
    let s = loaded(3);
    s = boardReducer(s, { type: 'DROP', track: 0, overId: 'tier-0' });
    s = boardReducer(s, { type: 'DROP', track: 0, overId: 'bench' });
    expect(s.assignment[0]).toBeNull();
    expect(s.benchOrder).toContain(0);
    expect(s.tierOrder[0]).toEqual([]);
  });
});

describe('DROP — guards', () => {
  it('ignores an out-of-range track', () => {
    const s = loaded(2);
    expect(view(boardReducer(s, { type: 'DROP', track: 9, overId: 'tier-0' }))).toEqual(view(s));
  });
  it('ignores an out-of-range tier container', () => {
    const s = loaded(2);
    expect(view(boardReducer(s, { type: 'DROP', track: 0, overId: 'tier-9' }))).toEqual(view(s));
  });
  it('does nothing without a source', () => {
    expect(boardReducer(initialState, { type: 'DROP', track: 0, overId: 'tier-0' })).toBe(
      initialState,
    );
  });
});

describe('rankScore — weighted needle', () => {
  const put = (s: BoardState, track: number, tier: string) =>
    boardReducer(s, { type: 'DROP', track, overId: tier });

  it('is 0 for an untouched board (all on the bench)', () => {
    expect(rankScore(loaded(5))).toBe(0);
  });

  it('reads 1.0 when every card is S', () => {
    let s = loaded(4);
    for (let i = 0; i < 4; i++) s = put(s, i, 'tier-0');
    expect(rankScore(s)).toBe(1);
  });

  it('reads ~0.78 when every card is A', () => {
    let s = loaded(4);
    for (let i = 0; i < 4; i++) s = put(s, i, 'tier-1');
    expect(rankScore(s)).toBeCloseTo(0.78, 5);
  });

  it('reads 0.2 when every card is D', () => {
    let s = loaded(4);
    for (let i = 0; i < 4; i++) s = put(s, i, 'tier-4');
    expect(rankScore(s)).toBeCloseTo(0.2, 5);
  });

  it('a stacked S/A board sits in the over-zone', () => {
    let s = loaded(4);
    s = put(s, 0, 'tier-0');
    s = put(s, 1, 'tier-0');
    s = put(s, 2, 'tier-1');
    s = put(s, 3, 'tier-1'); // 2×S + 2×A
    expect(rankScore(s)).toBeGreaterThanOrEqual(OVER_ZONE);
  });

  it('a top-heavy board (3S 4A 2B 1C 1D) touches the over-zone', () => {
    let s = loaded(11);
    const plan = ['tier-0', 'tier-0', 'tier-0', 'tier-1', 'tier-1', 'tier-1', 'tier-1', 'tier-2', 'tier-2', 'tier-3', 'tier-4'];
    plan.forEach((tier, i) => (s = put(s, i, tier)));
    expect(rankScore(s)).toBeGreaterThanOrEqual(OVER_ZONE);
  });

  it('advances more for a higher tier than a lower one', () => {
    const base = loaded(5);
    const oneS = rankScore(put(base, 0, 'tier-0'));
    const oneD = rankScore(put(base, 0, 'tier-4'));
    expect(oneS).toBeGreaterThan(oneD);
  });
});

describe('DROP — every tier is reachable', () => {
  it('places one bench track into each of the five tiers', () => {
    let s = loaded(5);
    for (let tier = 0; tier < 5; tier++) {
      s = boardReducer(s, { type: 'DROP', track: tier, overId: `tier-${tier}` });
    }
    expect(s.assignment).toEqual([0, 1, 2, 3, 4]);
    expect(s.benchOrder).toEqual([]);
  });
});
