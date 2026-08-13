import type { ResolvedSource, Track } from './types';

export const MAX_TRACKS = 100;

/**
 * Build a ResolvedSource from newline-separated titles.
 * The whole line is the title (no artist split) so it round-trips through
 * the URL, where manual boards encode titles verbatim.
 */
export function resolveManual(titles: string[]): ResolvedSource {
  const cleaned = titles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TRACKS);

  const tracks: Track[] = cleaned.map((title, index) => ({
    id: `m${index}`,
    title,
    artist: '',
    artworkUrl: null,
    durationMs: null,
    index,
  }));

  return {
    ref: { provider: 'manual', kind: 'album', id: 'manual' },
    title: 'Manual list',
    subtitle: `${tracks.length} track${tracks.length === 1 ? '' : 's'}`,
    artworkUrl: null,
    tracks,
  };
}

/** Split a textarea value into candidate title lines. */
export function parseManualInput(raw: string): string[] {
  return raw.split(/\r?\n/);
}
