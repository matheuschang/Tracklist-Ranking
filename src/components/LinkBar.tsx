import { useEffect, useState } from 'react';
import { useBoard } from '../state/BoardProvider';
import { parseLink, looksLikeLink, unsupportedReason } from '../providers/parseLink';
import { searchAppleAlbums, searchAppleArtists, type AlbumHit, type ArtistHit } from '../providers';

type Mode = 'tracks' | 'albums';

export function LinkBar() {
  const { loadManual, loadFromRef, state, exporting } = useBoard();
  const [mode, setMode] = useState<Mode>('tracks');
  const [value, setValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [albums, setAlbums] = useState<AlbumHit[] | null>(null);
  const [artists, setArtists] = useState<ArtistHit[] | null>(null);
  const loading = state.status === 'loading';

  useEffect(() => {
    if (state.status === 'ready') setCollapsed(true);
    if (state.status === 'error') setCollapsed(false);
  }, [state.status]);

  function clearResults() {
    setAlbums(null);
    setArtists(null);
    setLinkError(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    clearResults();
  }

  async function runAlbumSearch(query: string) {
    setSearching(true);
    clearResults();
    try {
      const hits = await searchAppleAlbums(query);
      setAlbums(hits);
      if (hits.length === 0) {
        setLinkError(
          `No albums found for “${query}”. Try adding the artist (e.g. “album – artist”), or paste a link.`,
        );
      }
    } catch {
      setLinkError('Couldn’t reach Apple search. Try again, or paste a link / track titles.');
    } finally {
      setSearching(false);
    }
  }

  async function runArtistSearch(query: string) {
    setSearching(true);
    clearResults();
    try {
      const hits = await searchAppleArtists(query);
      setArtists(hits);
      if (hits.length === 0) setLinkError(`No artist found for “${query}”. Check the spelling.`);
    } catch {
      setLinkError('Couldn’t reach Apple search. Try again.');
    } finally {
      setSearching(false);
    }
  }

  function submit() {
    const raw = value.trim();
    if (!raw) return;
    clearResults();

    if (mode === 'albums') {
      void runArtistSearch(raw);
      return;
    }

    // Tracks mode: one line is a link or an album search; many lines are a manual list.
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1) {
      const single = lines[0];
      if (looksLikeLink(single)) {
        const ref = parseLink(single);
        if (ref) void loadFromRef(ref);
        else
          setLinkError(
            unsupportedReason(single) ??
              'Couldn’t read that link. Search an album name instead, or paste track titles one per line.',
          );
        return;
      }
      void runAlbumSearch(single);
      return;
    }
    loadManual(raw);
  }

  function pickAlbum(hit: AlbumHit) {
    clearResults();
    setValue('');
    void loadFromRef({ provider: 'apple', kind: 'album', id: hit.id });
  }

  function pickArtist(hit: ArtistHit) {
    clearResults();
    setValue('');
    void loadFromRef({ provider: 'apple', kind: 'artist', id: hit.id });
  }

  async function pasteFromClipboard() {
    clearResults();
    let text = '';
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      document.querySelector<HTMLTextAreaElement>('.linkbar textarea')?.focus();
      return;
    }
    if (!text) return;
    setValue(text);
    // A copied link only makes sense in Tracks mode (it resolves to an album).
    if (mode !== 'tracks') return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1 && looksLikeLink(lines[0])) {
      const ref = parseLink(lines[0]);
      if (ref) void loadFromRef(ref);
      else setLinkError(unsupportedReason(lines[0]) ?? 'Couldn’t read that link.');
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  const error = linkError ?? (state.status === 'error' ? state.error : null);
  const placeholder =
    mode === 'albums'
      ? 'Search an artist to rank their albums'
      : 'Search an album — or “album – artist”\nOr paste a link / track titles, one per line';
  // Force the collapsed look while exporting, whatever the user's toggle state.
  const showCollapsed = collapsed || exporting;

  return (
    <div className={`linkbar${showCollapsed ? ' is-collapsed' : ''}`}>
      <div className="linkbar__head">
        <button
          type="button"
          className="linkbar__titlebtn"
          aria-expanded={!showCollapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="silk">Load source</span>
          <span className="lamp lamp--teal is-on" />
        </button>
        <span className="linkbar__spacer" />
        {showCollapsed ? (
          state.source && <span className="linkbar__folded">{state.source.title}</span>
        ) : (
          <div className="mode">
            <span className="mode__label">Rank by</span>
            <div className="mode__switch" role="radiogroup" aria-label="Rank mode">
              {(['tracks', 'albums'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  className={`mode__opt${mode === m ? ' is-on' : ''}`}
                  onClick={() => switchMode(m)}
                >
                  <span className="mode__lamp" aria-hidden="true" />
                  {m === 'tracks' ? 'Tracks' : 'Albums'}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="linkbar__chevron-btn"
          aria-label={showCollapsed ? 'Expand load source' : 'Collapse load source'}
          onClick={() => setCollapsed((c) => !c)}
        >
          {showCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {!showCollapsed && (
        <div className="linkbar__body">
          <div className="linkbar__row">
            <label className="field">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                aria-label={mode === 'albums' ? 'Artist search' : 'Album search, Apple Music link, or track titles'}
              />
              <button
                type="button"
                className="field__paste"
                onClick={pasteFromClipboard}
                title="Paste from clipboard"
                aria-label="Paste from clipboard"
              >
                Paste
              </button>
            </label>
            <button className="btn btn--primary" onClick={submit} disabled={loading || searching}>
              <span className="btn__lamp">◆</span>
              {searching ? 'Searching…' : loading ? 'Loading…' : 'Load'}
            </button>
          </div>

          {albums && albums.length > 0 && (
            <ul className="results" aria-label="Album results">
              {albums.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="result" onClick={() => pickAlbum(hit)}>
                    <span className="result__art">
                      {hit.artworkUrl ? (
                        <img src={hit.artworkUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="result__art--blank" />
                      )}
                    </span>
                    <span className="result__meta">
                      <span className="result__name">{hit.name}</span>
                      <span className="result__artist">{hit.artist}</span>
                    </span>
                    <span className="result__tail">
                      {hit.year ?? ''}
                      {hit.trackCount ? ` · ${hit.trackCount} trk` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {artists && artists.length > 0 && (
            <ul className="results" aria-label="Artist results">
              {artists.map((hit) => (
                <li key={hit.id}>
                  <button type="button" className="result result--artist" onClick={() => pickArtist(hit)}>
                    <span className="result__meta">
                      <span className="result__name">{hit.name}</span>
                      <span className="result__artist">{hit.genre ?? 'Artist'}</span>
                    </span>
                    <span className="result__tail">Discography ▸</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <p className="linkbar__error">{error}</p>
          ) : (
            <p className="linkbar__hint">
              {mode === 'albums'
                ? 'Pick an artist to rank their albums against each other.'
                : 'Search an album, paste an Apple Music link, or a manual list of titles.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
