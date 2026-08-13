import { describe, it, expect } from 'vitest';
import {
  encode,
  decode,
  encodeAssignment,
  decodeAssignment,
  encodeTitles,
  decodeTitles,
} from './urlState';
import type { ResolvedSource, SourceRef, Track } from '../providers/types';

function makeSource(ref: SourceRef, titles: string[]): ResolvedSource {
  const tracks: Track[] = titles.map((title, index) => ({
    id: `${ref.id}-${index}`,
    title,
    artist: 'Artist',
    artworkUrl: null,
    durationMs: null,
    index,
  }));
  return { ref, title: 'Album', subtitle: 'Artist', artworkUrl: null, tracks };
}

function randomAssignment(n: number): (number | null)[] {
  return Array.from({ length: n }, () => {
    const r = Math.floor(Math.random() * 6); // 0..4 tiers, 5 => bench(null)
    return r < 5 ? r : null;
  });
}

describe('assignment codec', () => {
  it('maps tiers to S A B C D and bench to -', () => {
    expect(encodeAssignment([0, 1, 2, 3, 4, null])).toBe('SABCD-');
  });

  it('decodes back to the same array', () => {
    expect(decodeAssignment('SABCD-', 6)).toEqual([0, 1, 2, 3, 4, null]);
  });

  it('treats unknown/short chars as bench', () => {
    expect(decodeAssignment('SX', 3)).toEqual([0, null, null]);
  });
});

describe('titles codec (base64url, utf-8)', () => {
  it('round-trips unicode and separators', () => {
    const titles = ['Café', 'Naïve — Live', '日本語', 'a/b+c=d', 'feat. X'];
    expect(decodeTitles(encodeTitles(titles))).toEqual(titles);
  });

  it('produces url-safe output (no + / =)', () => {
    const out = encodeTitles(['???>>><<<', 'ÿÿÿ']);
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe('encode / decode round-trip', () => {
  it('round-trips a spotify album with random assignments', () => {
    const ref: SourceRef = { provider: 'spotify', kind: 'album', id: '4aawyAB9vmqN3uQ7FjRGTy' };
    for (let iter = 0; iter < 200; iter++) {
      const n = 1 + Math.floor(Math.random() * 30);
      const titles = Array.from({ length: n }, (_, i) => `Track ${i}`);
      const assignment = randomAssignment(n);
      const search = encode({ source: makeSource(ref, titles), assignment });
      const decoded = decode(search);
      expect(decoded).not.toBeNull();
      expect(decoded!.ref).toEqual(ref);
      expect(decoded!.assignment).toEqual(assignment);
      expect(decoded!.titles).toBeNull(); // non-manual carries no titles
    }
  });

  it('round-trips a manual board including titles', () => {
    const ref: SourceRef = { provider: 'manual', kind: 'album', id: 'manual' };
    const titles = ['Bohemian Rhapsody', 'Under Pressure', 'Radio Ga Ga'];
    const assignment = [0, null, 2];
    const search = encode({ source: makeSource(ref, titles), assignment });
    const decoded = decode(search);
    expect(decoded!.ref).toEqual(ref);
    expect(decoded!.assignment).toEqual(assignment);
    expect(decoded!.titles).toEqual(titles);
  });

  it('url-encodes ids with awkward characters', () => {
    const ref: SourceRef = { provider: 'youtube', kind: 'playlist', id: 'OLAK5uy_a b/c' };
    const search = encode({ source: makeSource(ref, ['x']), assignment: [null] });
    expect(decode(search)!.ref.id).toBe('OLAK5uy_a b/c');
  });

  it('returns empty string when there is no source', () => {
    expect(encode({ source: null, assignment: [] })).toBe('');
  });
});

describe('decode of malformed input', () => {
  it('returns null without an s param', () => {
    expect(decode('?t=SAB')).toBeNull();
  });
  it('returns null for an unknown provider', () => {
    expect(decode('?s=deezer:album:123&t=S')).toBeNull();
  });
  it('returns null for a bad kind', () => {
    expect(decode('?s=spotify:single:123&t=S')).toBeNull();
  });
});
