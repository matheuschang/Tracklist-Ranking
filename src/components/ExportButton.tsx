import { useState } from 'react';
import { toPng } from 'html-to-image';
import { useBoard } from '../state/BoardProvider';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'board'
  );
}

export function ExportButton() {
  const { state, setExporting } = useBoard();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function exportPng() {
    const node = document.querySelector('.faceplate') as HTMLElement | null;
    if (!node || busy) return;
    setBusy(true);
    setFailed(false);
    setExporting(true); // collapse the load bar + hide bench/toolbar for the frame
    node.classList.add('is-exporting');
    // Let the export layout settle. On a phone this reflows the whole board
    // from the narrow mobile column to the wide desktop frame, so give it a
    // couple of frames plus a beat before capturing.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 90));
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        // artwork <img> already carries crossOrigin="anonymous" — no cacheBust,
        // which would re-fetch under a new URL and risk tainting the canvas.
        style: { margin: '0' },
      });
      const link = document.createElement('a');
      link.download = `tierlist-${slugify(state.source?.title ?? 'board')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed', err);
      setFailed(true);
    } finally {
      node.classList.remove('is-exporting');
      setExporting(false);
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn" onClick={exportPng} disabled={busy}>
        {busy ? 'Rendering…' : 'Export PNG'}
      </button>
      {failed && (
        <span className="url-meter is-warn" role="status">
          Export blocked by image CORS — retry, or reload the source.
        </span>
      )}
    </>
  );
}
