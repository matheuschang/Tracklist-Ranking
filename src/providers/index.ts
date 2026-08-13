import { ProviderError, type ResolvedSource, type SourceRef } from './types';
import { resolveManual, parseManualInput, MAX_TRACKS } from './manual';
import {
  resolveApple,
  searchAppleAlbums,
  searchAppleArtists,
  type AlbumHit,
  type ArtistHit,
} from './itunes';

export { resolveManual, parseManualInput, MAX_TRACKS, searchAppleAlbums, searchAppleArtists };
export type { AlbumHit, ArtistHit };

/**
 * Single entry point for link-based providers. Components import only this —
 * never `itunes.ts` / `spotify.ts` / `youtube.ts` directly.
 * Providers are wired up in their respective phases.
 */
export async function resolve(ref: SourceRef): Promise<ResolvedSource> {
  switch (ref.provider) {
    case 'apple':
      return resolveApple(ref);
    // 'spotify' | 'youtube' — wired in later phases.
    default:
      throw new ProviderError(
        'UNSUPPORTED',
        `Provider "${ref.provider}" is not available yet.`,
      );
  }
}
