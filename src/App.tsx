import { useState } from 'react';
import { useBoard } from './state/BoardProvider';
import { rankScore } from './state/boardReducer';
import { LinkBar } from './components/LinkBar';
import { Board } from './components/Board';
import { VuMeter } from './components/VuMeter';
import { ExportButton } from './components/ExportButton';

const URL_WARN_CHARS = 1500;

export default function App() {
  const { state, ranked, active, reset, shareSearch } = useBoard();
  const hasSource = !!state.source;
  // The needle tracks the weighted quality of the ranking, not raw progress.
  const fraction = rankScore(state);
  const isManual = state.source?.ref.provider === 'manual';

  const urlLength =
    (typeof window !== 'undefined'
      ? window.location.origin.length + window.location.pathname.length
      : 0) + shareSearch.length;
  const urlTooLong = isManual && urlLength > URL_WARN_CHARS;

  const [copied, setCopied] = useState(false);
  function copyLink() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="rack">
      <div className="faceplate">
        <header className="header">
          <div className="brand">
            <span className="brand__wordmark">Tracklist Ranking</span>
            <span className="brand__model">MODEL TR-5 · FIVE-BAND RANKING</span>
            {hasSource && state.source && (
              <span className="brand__source">
                <strong>{state.source.title}</strong>
                {state.source.subtitle ? ` — ${state.source.subtitle}` : ''}
              </span>
            )}
          </div>
          <VuMeter fraction={fraction} ranked={ranked} total={active} />
        </header>

        <LinkBar />

        {hasSource && (
          <>
            <Board />
            <div className="toolbar">
              <span className="silk">Board</span>
              <span className="vu__legend">
                {ranked} of {active} ranked
              </span>
              <span className="toolbar__spacer" />
              <span className={`url-meter${urlTooLong ? ' is-warn' : ''}`} title="Length of the shareable URL">
                URL {urlLength} CH
              </span>
              <button className="btn btn--ghost" onClick={copyLink}>
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
              <ExportButton />
              <button className="btn btn--ghost" onClick={reset} disabled={ranked === 0}>
                Reset
              </button>
            </div>
            {urlTooLong && (
              <p className="linkbar__hint" role="status">
                Long URL ({urlLength} chars) — some chat apps truncate links. Shorten the list if it
                gets cut off.
              </p>
            )}
          </>
        )}

        <p className="footnote">TRACKLIST RANKING · NO ACCOUNTS</p>
      </div>
    </div>
  );
}
