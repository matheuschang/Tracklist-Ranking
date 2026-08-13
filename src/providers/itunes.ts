import { ProviderError, type ResolvedSource, type SourceRef, type Track } from './types';
import { MAX_TRACKS } from './manual';

/** Base host is configurable so we can switch to the Worker proxy if CORS fails. */
const BASE = import.meta.env.VITE_ITUNES_BASE ?? 'https://itunes.apple.com';
const COUNTRY = import.meta.env.VITE_ITUNES_COUNTRY ?? 'BR';

/** Below this track count a "collection" is really a single/EP-of-one, not an album. */
const MIN_ALBUM_TRACKS = 3;

interface LookupEntry {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  collectionId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  discNumber?: number;
  trackNumber?: number;
  releaseDate?: string;
  trackCount?: number;
  primaryGenreName?: string;
}

function bigArt(url?: string | null): string | null {
  return url ? url.replace('/100x100bb', '/600x600bb') : null;
}

export interface AlbumHit {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string | null;
  year: string | null;
  trackCount: number | null;
}

/** Remix compilations / DJ mixes aren't albums people rank — drop them. */
const JUNK_COLLECTION = /(remix|dj mix|boiler room)/i;

async function getJson(url: string): Promise<{ results?: LookupEntry[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new ProviderError('UPSTREAM_ERROR', `Apple returned HTTP ${res.status}.`);
  return res.json();
}

function toAlbumHits(entries: LookupEntry[]): AlbumHit[] {
  return entries
    .filter((r) => r.wrapperType === 'collection' && r.collectionId != null)
    // Singles / one-off tracks are filed as tiny "albums" — drop them.
    .filter((r) => typeof r.trackCount === 'number' && r.trackCount >= MIN_ALBUM_TRACKS)
    .filter((r) => !JUNK_COLLECTION.test(r.collectionName ?? ''))
    .map((r) => ({
      id: String(r.collectionId),
      name: r.collectionName ?? 'Album',
      artist: r.artistName ?? '',
      artworkUrl: bigArt(r.artworkUrl100),
      year: r.releaseDate ? String(r.releaseDate).slice(0, 4) : null,
      trackCount: typeof r.trackCount === 'number' ? r.trackCount : null,
    }));
}

/** Collapse re-pressings by title and order newest-first (deterministic). */
function dedupeAndSort(hits: AlbumHit[]): AlbumHit[] {
  const seen = new Set<string>();
  const out: AlbumHit[] = [];
  for (const h of hits) {
    const key = h.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  out.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || a.name.localeCompare(b.name));
  return out;
}

/** Match an artist by name, then list their full album catalog. */
async function albumsByArtist(term: string): Promise<AlbumHit[]> {
  const artistUrl = `${BASE}/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=1&country=${COUNTRY}`;
  const artistData = await getJson(artistUrl);
  const artist = (artistData.results ?? []).find((x) => x.wrapperType === 'artist' && x.artistId != null);
  if (!artist) return [];
  const albumsUrl = `${BASE}/lookup?id=${artist.artistId}&entity=album&limit=100&country=${COUNTRY}`;
  const albumsData = await getJson(albumsUrl);
  return toAlbumHits(albumsData.results ?? []);
}

/** Fuzzy term search over album titles (good when the query is an album name). */
async function albumsByTerm(term: string): Promise<AlbumHit[]> {
  const url = `${BASE}/search?term=${encodeURIComponent(term)}&entity=album&limit=25&country=${COUNTRY}`;
  const data = await getJson(url);
  return toAlbumHits(data.results ?? []);
}

/**
 * Search the public iTunes catalog for albums. Accepts an artist, an album
 * name, or "album - artist" (the dash is collapsed to a space).
 *
 * iTunes term-search alone misses most of an artist's discography (it returns
 * mostly singles), so we run BOTH an artist-catalog lookup and a term search
 * and merge them — the artist path supplies the real albums, the term path
 * covers album-name queries.
 */
export async function searchAppleAlbums(query: string): Promise<AlbumHit[]> {
  const term = query.replace(/\s*[-–—]\s*/g, ' ').trim();
  if (!term) return [];

  const settled = await Promise.allSettled([albumsByArtist(term), albumsByTerm(term)]);
  if (settled.every((r) => r.status === 'rejected')) {
    throw new ProviderError('UPSTREAM_ERROR', 'Couldn’t reach Apple search from the browser.');
  }
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return dedupeAndSort(all);
}

export interface ArtistHit {
  id: string;
  name: string;
  genre: string | null;
}

/** Search for artists (Albums mode picks one, then ranks their discography). */
export async function searchAppleArtists(query: string): Promise<ArtistHit[]> {
  const term = query.replace(/\s*[-–—]\s*/g, ' ').trim();
  if (!term) return [];
  const url = `${BASE}/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=8&country=${COUNTRY}`;

  let data: { results?: LookupEntry[] };
  try {
    data = await getJson(url);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError('UPSTREAM_ERROR', 'Couldn’t reach Apple search from the browser.');
  }
  return (data.results ?? [])
    .filter((r) => r.wrapperType === 'artist' && r.artistId != null)
    .map((r) => ({
      id: String(r.artistId),
      name: r.artistName ?? 'Artist',
      genre: r.primaryGenreName ?? null,
    }));
}

/** Resolve an artist's discography into a board where each card is an album. */
export async function resolveAppleArtist(artistId: string): Promise<ResolvedSource> {
  const url = `${BASE}/lookup?id=${encodeURIComponent(artistId)}&entity=album&limit=100&country=${COUNTRY}`;

  let data: { results?: LookupEntry[] };
  try {
    data = await getJson(url);
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError('UPSTREAM_ERROR', 'Couldn’t reach Apple from the browser.');
  }

  const results = data.results ?? [];
  const artistName = results.find((r) => r.wrapperType === 'artist')?.artistName ?? 'Artist';
  const albums = dedupeAndSort(toAlbumHits(results));
  if (albums.length === 0) {
    throw new ProviderError('NOT_FOUND', 'No albums found for that artist.');
  }

  const tracks: Track[] = albums.slice(0, MAX_TRACKS).map((a, index) => ({
    id: a.id,
    title: a.name,
    artist: artistName,
    artworkUrl: a.artworkUrl,
    durationMs: null,
    index,
  }));

  return {
    ref: { provider: 'apple', kind: 'artist', id: String(artistId) },
    title: artistName,
    subtitle: `Discography · ${tracks.length} albums`,
    artworkUrl: albums[0].artworkUrl,
    tracks,
  };
}

export async function resolveApple(ref: SourceRef): Promise<ResolvedSource> {
  if (ref.kind === 'artist') return resolveAppleArtist(ref.id);
  if (ref.kind !== 'album') {
    throw new ProviderError(
      'UNSUPPORTED',
      "Apple Music playlists aren’t available through the public catalog API. Paste an album link, or paste the track names.",
    );
  }

  const url = `${BASE}/lookup?id=${encodeURIComponent(ref.id)}&entity=song&limit=200&country=${COUNTRY}`;

  let data: { results?: LookupEntry[] };
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new ProviderError('UPSTREAM_ERROR', `Apple returned HTTP ${res.status}.`);
    }
    data = await res.json();
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    // Network or CORS failure (this endpoint's CORS is inconsistent by region).
    throw new ProviderError(
      'UPSTREAM_ERROR',
      'Couldn’t reach Apple from the browser (often a CORS block). Try again, or paste the track names.',
    );
  }

  const results = data.results ?? [];
  const collection = results.find((r) => r.wrapperType === 'collection');
  const rawTracks = results.filter((r) => r.wrapperType === 'track' && r.kind === 'song');

  if (!collection || rawTracks.length === 0) {
    throw new ProviderError('NOT_FOUND', 'No album found for that link.');
  }

  // The API does not guarantee order — sort by disc then track number.
  rawTracks.sort(
    (a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0),
  );

  const tracks: Track[] = rawTracks.slice(0, MAX_TRACKS).map((t, index) => ({
    id: String(t.trackId ?? `a${index}`),
    title: t.trackName ?? 'Untitled',
    artist: t.artistName ?? collection.artistName ?? '',
    artworkUrl: bigArt(t.artworkUrl100),
    durationMs: t.trackTimeMillis ?? null,
    index,
  }));

  return {
    ref,
    title: collection.collectionName ?? 'Album',
    subtitle: collection.artistName ?? '',
    artworkUrl: bigArt(collection.artworkUrl100),
    tracks,
  };
}
