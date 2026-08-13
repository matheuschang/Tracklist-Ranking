import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  boardReducer,
  initialState,
  rankedCount,
  activeCount,
  type BoardState,
} from './boardReducer';
import { resolveManual, parseManualInput, resolve } from '../providers';
import { ProviderError, type ProviderErrorCode, type ResolvedSource, type SourceRef } from '../providers/types';
import { encode, decode } from './urlState';

function errorCopy(code: ProviderErrorCode, fallback: string): string {
  switch (code) {
    case 'EDITORIAL_BLOCKED':
      return 'Spotify blocks its own editorial and algorithmic playlists (Discover Weekly, Top 50, and similar) for third-party apps. A playlist made by a person works. So does any album.';
    case 'NOT_FOUND':
      return 'Couldn’t find that album or playlist. Check the link, or paste the track names instead.';
    case 'BAD_ID':
      return 'That link doesn’t look right. Paste the full album or playlist URL.';
    case 'UNSUPPORTED':
      return fallback;
    case 'UPSTREAM_ERROR':
    default:
      return 'The music service didn’t respond. Try again, or paste the track names instead.';
  }
}

interface BoardContextValue {
  state: BoardState;
  /** synchronous latest state, for DnD handlers that fire faster than render. */
  getState: () => BoardState;
  loadManual: (raw: string) => void;
  loadSource: (source: ResolvedSource, assignment?: (number | null)[]) => void;
  loadFromRef: (ref: SourceRef, assignment?: (number | null)[]) => Promise<void>;
  moveTrack: (track: number, toTier: number | null, toPos?: number) => void;
  /** drag drop: reducer resolves position from its own state (staleness-proof). */
  drop: (track: number, overId: string | number) => void;
  assignTrack: (track: number, tier: number | null) => void;
  toggleExclude: (track: number) => void;
  reset: () => void;
  /** true while capturing the PNG — the UI collapses chrome for a clean frame. */
  exporting: boolean;
  setExporting: (v: boolean) => void;
  ranked: number;
  total: number;
  /** non-ignored track count (denominator for the meter / counter). */
  active: number;
  /** current query string for the board (leading `?`), '' when empty. */
  shareSearch: string;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  const [exporting, setExporting] = useState(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const getState = useCallback(() => stateRef.current, []);

  const loadSource = useCallback(
    (source: ResolvedSource, assignment?: (number | null)[]) => {
      dispatch({ type: 'LOAD_SOURCE', source, assignment });
    },
    [],
  );

  const loadManual = useCallback((raw: string) => {
    const source = resolveManual(parseManualInput(raw));
    dispatch({ type: 'LOAD_SOURCE', source });
  }, []);

  const loadFromRef = useCallback(
    async (ref: SourceRef, assignment?: (number | null)[], excluded?: boolean[]) => {
      dispatch({ type: 'LOADING' });
      try {
        const source = await resolve(ref);
        dispatch({ type: 'LOAD_SOURCE', source, assignment, excluded });
      } catch (err) {
        const message =
          err instanceof ProviderError
            ? errorCopy(err.code, err.message)
            : 'Something went wrong loading that link.';
        dispatch({ type: 'ERROR', message });
      }
    },
    [],
  );

  const moveTrack = useCallback(
    (track: number, toTier: number | null, toPos?: number) => {
      dispatch({ type: 'MOVE_TRACK', track, toTier, toPos });
    },
    [],
  );

  const drop = useCallback((track: number, overId: string | number) => {
    dispatch({ type: 'DROP', track, overId });
  }, []);

  const assignTrack = useCallback((track: number, tier: number | null) => {
    dispatch({ type: 'MOVE_TRACK', track, toTier: tier });
  }, []);

  const toggleExclude = useCallback((track: number) => {
    dispatch({ type: 'TOGGLE_EXCLUDE', track });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // ---- Hydrate from the URL, once, on first mount --------------------------
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const decoded = decode(window.location.search);
    if (!decoded) return;
    if (decoded.ref.provider === 'manual') {
      if (decoded.titles && decoded.titles.length > 0) {
        dispatch({
          type: 'LOAD_SOURCE',
          source: resolveManual(decoded.titles),
          assignment: decoded.assignment,
          excluded: decoded.excluded,
        });
      }
    } else {
      void loadFromRef(decoded.ref, decoded.assignment, decoded.excluded);
    }
  }, [loadFromRef]);

  // ---- Persist to the URL on every change (debounced) ----------------------
  useEffect(() => {
    if (state.status !== 'ready') return;
    const handle = window.setTimeout(() => {
      const search = encode(state);
      const url = search || window.location.pathname;
      window.history.replaceState(null, '', url);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [state]);

  const value = useMemo<BoardContextValue>(
    () => ({
      state,
      getState,
      loadManual,
      loadSource,
      loadFromRef,
      moveTrack,
      drop,
      assignTrack,
      toggleExclude,
      reset,
      exporting,
      setExporting,
      ranked: rankedCount(state),
      total: state.source?.tracks.length ?? 0,
      active: activeCount(state),
      shareSearch: encode(state),
    }),
    [state, getState, loadManual, loadSource, loadFromRef, moveTrack, drop, assignTrack, toggleExclude, reset, exporting],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used within a BoardProvider');
  return ctx;
}
