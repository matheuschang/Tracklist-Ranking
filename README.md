# Tracklist Ranking

Search an album (or an artist's discography), drag the tracks — or albums — into
S / A / B / C / D tiers, and share the result. The whole board lives in the URL,
so there are no accounts and no backend.

**Live:** https://matheuschang.github.io/Tracklist-Ranking/

## Features

- **Rank tracks or albums** — a hardware-style switch toggles between ranking an
  album's tracks or an artist's whole discography.
- **Apple Music search** — type an album, `album – artist`, or an artist name;
  results come straight from the public iTunes catalog (no key, no server).
- **Manual lists** — paste track titles, one per line.
- **Drag, keyboard, touch** — drag cards, or focus one and press `S A B C D` to
  assign, `0` to send it back, `X` to ignore a bench card in the score.
- **Weighted VU meter** — the needle reflects the quality of the ranking, not
  just how much is placed.
- **Ignore cards** — bench cards you don't want to rank are greyed out and left
  out of the meter.
- **Shareable URL** — the board round-trips through the address bar.
- **PNG export** — a clean image of the header + tiers.

## Stack

Vite + React 18 + TypeScript. Self-hosted fonts (Archivo / IBM Plex). No state
library — a single `useReducer`. Styling is plain CSS driven by `styles/tokens.css`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # static output in dist/
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. Enable it once under **Settings → Pages → Source:
GitHub Actions**.
