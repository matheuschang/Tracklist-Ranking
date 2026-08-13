import { describe, it, expect } from 'vitest';
import { parseLink, looksLikeLink, unsupportedReason } from './parseLink';

describe('parseLink — Apple', () => {
  it('parses an album url with locale and slug', () => {
    expect(parseLink('https://music.apple.com/br/album/thriller/269572838')).toEqual({
      provider: 'apple',
      kind: 'album',
      id: '269572838',
    });
  });
  it('ignores the ?i= single-track decoration', () => {
    expect(
      parseLink('https://music.apple.com/us/album/off-the-wall/1440730969?i=1440731168'),
    ).toEqual({ provider: 'apple', kind: 'album', id: '1440730969' });
  });
  it('strips trailing slashes', () => {
    expect(parseLink('https://music.apple.com/us/album/x/123/')).toEqual({
      provider: 'apple',
      kind: 'album',
      id: '123',
    });
  });
});

describe('parseLink — Spotify', () => {
  it('parses album and playlist urls', () => {
    expect(parseLink('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')).toEqual({
      provider: 'spotify',
      kind: 'album',
      id: '4aawyAB9vmqN3uQ7FjRGTy',
    });
    expect(
      parseLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc'),
    ).toEqual({ provider: 'spotify', kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
  });
  it('parses the spotify: uri scheme', () => {
    expect(parseLink('spotify:album:4aawyAB9vmqN3uQ7FjRGTy')).toEqual({
      provider: 'spotify',
      kind: 'album',
      id: '4aawyAB9vmqN3uQ7FjRGTy',
    });
  });
  it('rejects a malformed (non-22-char) id', () => {
    expect(parseLink('https://open.spotify.com/album/tooShort')).toBeNull();
  });
});

describe('parseLink — YouTube', () => {
  it('parses a playlist list id', () => {
    expect(parseLink('https://music.youtube.com/playlist?list=OLAK5uy_abc123')).toEqual({
      provider: 'youtube',
      kind: 'playlist',
      id: 'OLAK5uy_abc123',
    });
  });
  it('rejects auto-generated radio/mix ids', () => {
    expect(parseLink('https://www.youtube.com/playlist?list=RDabc')).toBeNull();
    expect(parseLink('https://www.youtube.com/playlist?list=LM')).toBeNull();
  });
});

describe('parseLink — misc', () => {
  it('returns null for unknown hosts and plain text', () => {
    expect(parseLink('https://example.com/album/1')).toBeNull();
    expect(parseLink('Bohemian Rhapsody')).toBeNull();
    expect(parseLink('')).toBeNull();
  });
});

describe('looksLikeLink', () => {
  it('recognizes http(s) and spotify uris only', () => {
    expect(looksLikeLink('https://x.com')).toBe(true);
    expect(looksLikeLink('spotify:album:4aawyAB9vmqN3uQ7FjRGTy')).toBe(true);
    expect(looksLikeLink('Just a title')).toBe(false);
  });
});

describe('unsupportedReason', () => {
  it('explains Apple playlists', () => {
    expect(unsupportedReason('https://music.apple.com/us/playlist/x/pl.123')).toMatch(/playlists/i);
  });
  it('explains YouTube radio/mix', () => {
    expect(unsupportedReason('https://www.youtube.com/playlist?list=RDabc')).toMatch(/mixes/i);
  });
  it('returns null for genuinely unknown links', () => {
    expect(unsupportedReason('https://example.com')).toBeNull();
  });
});
