import type { SourceRef } from './types';

/**
 * Turn a pasted string into a SourceRef, or null if no provider matches
 * (caller then shows the manual paste affordance).
 *
 * Strips `si`/`utm_*` params and trailing slashes before matching.
 * Spotify base62 ids are validated at 22 chars so a typo fails clearly.
 */
export function parseLink(raw: string): SourceRef | null {
  const input = raw.trim();
  if (!input) return null;

  // spotify:album:<id> / spotify:playlist:<id>
  const uri = /^spotify:(album|playlist):([A-Za-z0-9]{22})$/i.exec(input);
  if (uri) {
    return { provider: 'spotify', kind: uri[1].toLowerCase() as 'album' | 'playlist', id: uri[2] };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');

  // Apple / iTunes — album only. /<locale>/album/<slug>/<digits> (ignore ?i=)
  if (host === 'music.apple.com' || host === 'itunes.apple.com') {
    const m = /\/album\/[^/]+\/(\d+)/.exec(path);
    if (m) return { provider: 'apple', kind: 'album', id: m[1] };
    return null;
  }

  // Spotify — open.spotify.com/(album|playlist)/<base62>
  if (host === 'open.spotify.com') {
    const m = /^\/(album|playlist)\/([A-Za-z0-9]{22})/.exec(path);
    if (m) return { provider: 'spotify', kind: m[1] as 'album' | 'playlist', id: m[2] };
    return null;
  }

  // YouTube — (music.)youtube.com/playlist?list=<id>
  if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
    if (path === '/playlist') {
      const list = url.searchParams.get('list');
      if (list && !/^(RD|LM|WL)/.test(list)) {
        return { provider: 'youtube', kind: 'playlist', id: list };
      }
    }
    return null;
  }

  return null;
}

/** Heuristic: does this single line look like a URL / provider URI at all? */
export function looksLikeLink(raw: string): boolean {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) || /^spotify:(album|playlist):/i.test(s);
}

/**
 * For links we recognize but cannot resolve, return a specific explanation.
 * Returns null when we have nothing better than the generic message.
 */
export function unsupportedReason(raw: string): string | null {
  const input = raw.trim();
  let url: URL | null = null;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');

  if ((host === 'music.apple.com' || host === 'itunes.apple.com') && /\/playlist\//.test(path)) {
    return "Apple Music playlists aren’t available through the public catalog API. Paste an album link, or paste the track names.";
  }
  if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
    const list = url.searchParams.get('list');
    if (list && /^(RD|LM|WL)/.test(list)) {
      return 'Auto-generated YouTube mixes, radio, and Watch Later can’t be resolved. Paste a normal playlist or an album (its list id starts with OLAK5uy_).';
    }
  }
  return null;
}
