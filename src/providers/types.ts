export type ProviderId = 'apple' | 'spotify' | 'youtube' | 'manual';

export interface SourceRef {
  provider: ProviderId;
  /** 'artist' = the artist's discography, ranked as albums. */
  kind: 'album' | 'playlist' | 'artist';
  id: string; // provider-native id, no URL decoration
}

export interface Track {
  id: string; // provider-native track id, or `m${index}` for manual
  title: string; // cleaned
  artist: string;
  artworkUrl: string | null; // prefer >= 300px square
  durationMs: number | null;
  /**
   * 0-based position in the ORIGINAL source order.
   * This is the URL encoding key — never reorder it after load.
   */
  index: number;
}

export interface ResolvedSource {
  ref: SourceRef;
  title: string; // album or playlist name
  subtitle: string; // artist, or playlist owner
  artworkUrl: string | null;
  tracks: Track[];
}

export interface Provider {
  id: ProviderId;
  resolve(ref: SourceRef): Promise<ResolvedSource>;
}

/** Error shape shared by providers and the Worker. */
export type ProviderErrorCode =
  | 'NOT_FOUND'
  | 'EDITORIAL_BLOCKED'
  | 'UPSTREAM_ERROR'
  | 'BAD_ID'
  | 'UNSUPPORTED';

export class ProviderError extends Error {
  code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}
