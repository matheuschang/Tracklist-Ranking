import type { ResolvedSource } from '../providers/types';

/** Five fixed tiers, top to bottom. `null` tier = the bench. */
export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
export const TIER_COUNT = TIERS.length;

export interface BoardState {
  source: ResolvedSource | null;
  /** assignment[i] = tier index for tracks[i], or null when unranked (bench). */
  assignment: (number | null)[];
  /** excluded[i] = true → ignored: greyed out, always on the bench, and left
   *  out of the VU-meter metric entirely (neither numerator nor denominator). */
  excluded: boolean[];
  /** order within each tier, as arrays of track indices. */
  tierOrder: number[][];
  benchOrder: number[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

export type BoardAction =
  | { type: 'LOADING' }
  | {
      type: 'LOAD_SOURCE';
      source: ResolvedSource;
      /** optional initial assignment (e.g. hydrated from the URL). */
      assignment?: (number | null)[];
      /** optional initial excluded flags (hydrated from the URL). */
      excluded?: boolean[];
    }
  | { type: 'ERROR'; message: string }
  | { type: 'MOVE_TRACK'; track: number; toTier: number | null; toPos?: number }
  | { type: 'TOGGLE_EXCLUDE'; track: number }
  /**
   * Drag drop. `overId` is the raw dnd-kit target: a container id
   * ('bench' | 'tier-N') or a track index (drop before that card). The reducer
   * resolves the destination + position from its OWN current state, so it never
   * depends on a possibly-stale snapshot read in the component during a drag.
   */
  | { type: 'DROP'; track: number; overId: string | number }
  | { type: 'RESET' };

export const initialState: BoardState = {
  source: null,
  assignment: [],
  excluded: [],
  tierOrder: emptyTiers(),
  benchOrder: [],
  status: 'idle',
  error: null,
};

function emptyTiers(): number[][] {
  return Array.from({ length: TIER_COUNT }, () => []);
}

/** Build tier/bench ordering arrays from a flat assignment, in source order. */
export function deriveOrdering(assignment: (number | null)[]): {
  tierOrder: number[][];
  benchOrder: number[];
} {
  const tierOrder = emptyTiers();
  const benchOrder: number[] = [];
  assignment.forEach((tier, index) => {
    if (tier === null || tier < 0 || tier >= TIER_COUNT) {
      benchOrder.push(index);
    } else {
      tierOrder[tier].push(index);
    }
  });
  return { tierOrder, benchOrder };
}

function removeFromEverywhere(state: BoardState, track: number) {
  const tierOrder = state.tierOrder.map((lane) => lane.filter((t) => t !== track));
  const benchOrder = state.benchOrder.filter((t) => t !== track);
  return { tierOrder, benchOrder };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading', error: null };

    case 'ERROR':
      return { ...state, status: 'error', error: action.message };

    case 'LOAD_SOURCE': {
      const n = action.source.tracks.length;
      const assignment =
        action.assignment && action.assignment.length === n
          ? action.assignment.slice()
          : Array<number | null>(n).fill(null);
      const excluded =
        action.excluded && action.excluded.length === n
          ? action.excluded.slice()
          : Array<boolean>(n).fill(false);
      const { tierOrder, benchOrder } = deriveOrdering(assignment);
      return {
        source: action.source,
        assignment,
        excluded,
        tierOrder,
        benchOrder,
        status: 'ready',
        error: null,
      };
    }

    case 'MOVE_TRACK': {
      if (!state.source) return state;
      const { track, toTier } = action;
      if (track < 0 || track >= state.assignment.length) return state;

      const { tierOrder, benchOrder } = removeFromEverywhere(state, track);
      const assignment = state.assignment.slice();
      const excluded = state.excluded.slice();

      if (toTier === null) {
        const pos = clampInsert(action.toPos, benchOrder.length);
        benchOrder.splice(pos, 0, track);
        assignment[track] = null;
      } else {
        const lane = tierOrder[toTier];
        const pos = clampInsert(action.toPos, lane.length);
        lane.splice(pos, 0, track);
        assignment[track] = toTier;
        excluded[track] = false; // ranking a card un-ignores it
      }

      return { ...state, assignment, excluded, tierOrder, benchOrder };
    }

    case 'DROP': {
      if (!state.source) return state;
      const { track, overId } = action;
      if (track < 0 || track >= state.assignment.length) return state;

      // Resolve destination tier + the card to insert before, from CURRENT state.
      let toTier: number | null;
      let beforeTrack: number | null = null;

      if (overId === 'bench') {
        toTier = null;
      } else if (typeof overId === 'string' && overId.startsWith('tier-')) {
        toTier = Number(overId.slice(5));
      } else {
        // overId is a track index: drop into that card's lane, before it.
        const overTrack = Number(overId);
        if (Number.isNaN(overTrack)) return state;
        const t = state.assignment[overTrack];
        toTier = t == null ? null : t;
        beforeTrack = overTrack;
      }
      if (toTier !== null && (toTier < 0 || toTier >= TIER_COUNT)) return state;

      const { tierOrder, benchOrder } = removeFromEverywhere(state, track);
      const assignment = state.assignment.slice();
      const excluded = state.excluded.slice();
      const lane = toTier === null ? benchOrder : tierOrder[toTier];

      let pos = lane.length; // default: append
      if (beforeTrack != null && beforeTrack !== track) {
        const idx = lane.indexOf(beforeTrack);
        if (idx >= 0) pos = idx;
      }
      lane.splice(pos, 0, track);
      assignment[track] = toTier;
      if (toTier !== null) excluded[track] = false; // ranking un-ignores

      return { ...state, assignment, excluded, tierOrder, benchOrder };
    }

    case 'TOGGLE_EXCLUDE': {
      if (!state.source) return state;
      const { track } = action;
      if (track < 0 || track >= state.assignment.length) return state;

      const excluded = state.excluded.slice();
      const nowExcluded = !excluded[track];
      excluded[track] = nowExcluded;

      if (!nowExcluded) {
        // Un-ignoring leaves the card where it is (on the bench).
        return { ...state, excluded };
      }
      // Ignoring parks the card on the bench, out of any tier.
      const { tierOrder, benchOrder } = removeFromEverywhere(state, track);
      if (!benchOrder.includes(track)) benchOrder.push(track);
      const assignment = state.assignment.slice();
      assignment[track] = null;
      return { ...state, excluded, assignment, tierOrder, benchOrder };
    }

    case 'RESET': {
      if (!state.source) return state;
      // Clears tier placements but keeps the ignored set intact.
      const assignment = Array<number | null>(state.assignment.length).fill(null);
      const { tierOrder, benchOrder } = deriveOrdering(assignment);
      return { ...state, assignment, tierOrder, benchOrder };
    }

    default:
      return state;
  }
}

function clampInsert(pos: number | undefined, length: number): number {
  if (pos === undefined || pos > length) return length;
  if (pos < 0) return 0;
  return pos;
}

/** Number of tracks assigned to any tier (i.e. off the bench). */
export function rankedCount(state: BoardState): number {
  return state.assignment.reduce<number>((acc, t) => acc + (t !== null ? 1 : 0), 0);
}

/** Tracks that still count toward the board (everything except ignored ones). */
export function activeCount(state: BoardState): number {
  return state.excluded.reduce<number>((acc, ex) => acc + (ex ? 0 : 1), 0);
}

/**
 * Per-tier quality on a 0–1 scale, S (best) → D. These are used DIRECTLY (not
 * normalised by the max) so that boosting S widens the S→A gap without dragging
 * mixed boards down. S has the biggest step below it, so it pulls hardest.
 * Bench / unranked counts as 0.
 */
export const TIER_QUALITY = [1.0, 0.78, 0.58, 0.38, 0.2] as const; // S, A, B, C, D

/** Fraction of the scale that reads as the amber "over-zone" (peak). */
export const OVER_ZONE = 0.68;

/**
 * Ranking score in [0, 1] that drives the VU needle: the average tier quality
 * across every counted track. An all-S board reads 1.0 (pinned right), all-A
 * ≈ 0.78, and a top-heavy board (lots of S/A, few lows) lands in the over-zone.
 * The bench pulls it down (quality 0); ignored cards are left out entirely.
 */
export function rankScore(state: BoardState): number {
  let sum = 0;
  let count = 0;
  state.assignment.forEach((t, i) => {
    if (state.excluded[i]) return; // ignored cards don't count at all
    count++;
    if (t !== null && t >= 0 && t < TIER_QUALITY.length) sum += TIER_QUALITY[t];
  });
  if (count === 0) return 0;
  return sum / count;
}
