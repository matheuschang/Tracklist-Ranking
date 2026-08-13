import type { BoardState } from './boardReducer';
import { TIERS } from './boardReducer';
import type { ProviderId, SourceRef } from '../providers/types';

/**
 * URL state — the whole point is shareability without a backend.
 *
 *   ?s=<provider>:<kind>:<id>&t=<assignment>&m=<base64url titles>
 *
 * - `s` — e.g. spotify:album:4aawyAB9vmqN3uQ7FjRGTy (id is URL-encoded).
 * - `t` — one char per track in SOURCE order. S A B C D for the five tiers,
 *         `-` for unranked. Within-tier order is not encoded (falls into the
 *         tier in source order on load) — keeps a 50-track board to 50 chars.
 * - `m` — manual boards only: base64url of titles joined by "\n".
 *
 * encode/decode are pure and round-trip: decode(encode(state)) === state input.
 */

const TIER_CHARS = TIERS as readonly string[]; // ['S','A','B','C','D']
const BENCH_CHAR = '-';

const PROVIDERS: ProviderId[] = ['apple', 'spotify', 'youtube', 'manual'];
function isProvider(x: string): x is ProviderId {
  return (PROVIDERS as string[]).includes(x);
}

export function encodeAssignment(assignment: (number | null)[]): string {
  return assignment
    .map((t) => (t == null || t < 0 || t >= TIER_CHARS.length ? BENCH_CHAR : TIER_CHARS[t]))
    .join('');
}

export function decodeAssignment(t: string, length: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < length; i++) {
    const ch = t[i];
    const idx = ch ? TIER_CHARS.indexOf(ch.toUpperCase()) : -1;
    out.push(idx >= 0 ? idx : null);
  }
  return out;
}

/** UTF-8 safe base64url encode. */
export function encodeTitles(titles: string[]): string {
  const bytes = new TextEncoder().encode(titles.join('\n'));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeTitles(b64url: string): string[] {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes).split('\n');
}

const EXCLUDED_CHAR = 'X';

/** Serialize board state to a query string (leading `?`), or '' if no source. */
export function encode(
  state: Pick<BoardState, 'source' | 'assignment'> & { excluded?: boolean[] },
): string {
  if (!state.source) return '';
  const { ref } = state.source;
  const excluded = state.excluded ?? [];
  // One char per track: 'X' = ignored, S/A/B/C/D = tier, '-' = bench.
  const chars = state.assignment
    .map((t, i) =>
      excluded[i]
        ? EXCLUDED_CHAR
        : t == null || t < 0 || t >= TIER_CHARS.length
          ? BENCH_CHAR
          : TIER_CHARS[t],
    )
    .join('');
  const parts = [`s=${ref.provider}:${ref.kind}:${encodeURIComponent(ref.id)}`, `t=${chars}`];
  if (ref.provider === 'manual') {
    parts.push(`m=${encodeTitles(state.source.tracks.map((t) => t.title))}`);
  }
  return `?${parts.join('&')}`;
}

export interface DecodedBoard {
  ref: SourceRef;
  assignment: (number | null)[];
  excluded: boolean[];
  /** present only for manual boards */
  titles: string[] | null;
}

export function decode(search: string): DecodedBoard | null {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  const s = params.get('s');
  if (!s) return null;

  const firstColon = s.indexOf(':');
  const secondColon = s.indexOf(':', firstColon + 1);
  if (firstColon < 0 || secondColon < 0) return null;
  const provider = s.slice(0, firstColon);
  const kind = s.slice(firstColon + 1, secondColon);
  const id = decodeURIComponent(s.slice(secondColon + 1));
  if (!isProvider(provider) || (kind !== 'album' && kind !== 'playlist' && kind !== 'artist')) {
    return null;
  }

  const ref: SourceRef = { provider, kind, id };
  const t = params.get('t') ?? '';
  const m = params.get('m');
  const titles = m ? decodeTitles(m) : null;

  // one char per track → assignment length is the track count.
  const length = titles ? titles.length : t.length;
  const assignment: (number | null)[] = [];
  const excluded: boolean[] = [];
  for (let i = 0; i < length; i++) {
    const ch = t[i];
    if (ch && ch.toUpperCase() === EXCLUDED_CHAR) {
      assignment.push(null);
      excluded.push(true);
    } else {
      const idx = ch ? TIER_CHARS.indexOf(ch.toUpperCase()) : -1;
      assignment.push(idx >= 0 ? idx : null);
      excluded.push(false);
    }
  }

  return { ref, assignment, excluded, titles };
}
