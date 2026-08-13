import { useEffect, useState } from 'react';
import { OVER_ZONE } from '../state/boardReducer';

interface VuMeterProps {
  /** 0..1 fraction of tracks assigned to a tier. */
  fraction: number;
  ranked: number;
  total: number;
}

const SWEEP = 52; // degrees each side of centre
const PIVOT_X = 100;
const PIVOT_Y = 94;
const NEEDLE_LEN = 78;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Point on the needle-tip arc for a given fraction (0..1). */
function tip(fraction: number, radius = NEEDLE_LEN) {
  const angle = (-SWEEP + fraction * SWEEP * 2) * (Math.PI / 180);
  return {
    x: PIVOT_X + radius * Math.sin(angle),
    y: PIVOT_Y - radius * Math.cos(angle),
  };
}

export function VuMeter({ fraction, ranked, total }: VuMeterProps) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const angle = -SWEEP + clamped * SWEEP * 2;
  // "Peak" lamp: needle has swept into the amber over-zone (a top-heavy board).
  const pinned = clamped >= OVER_ZONE;

  // Snap on first paint, animate afterwards (so hydration doesn't sweep).
  const [reduced] = useState(prefersReducedMotion);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const animate = mounted && !reduced;

  // Arc for the scale backdrop.
  const arcStart = tip(0, NEEDLE_LEN + 4);
  const arcEnd = tip(1, NEEDLE_LEN + 4);
  const arcRadius = NEEDLE_LEN + 4;

  // Tick marks along the scale.
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const f = i / 10;
    const outer = tip(f, NEEDLE_LEN + 4);
    const inner = tip(f, NEEDLE_LEN - (i % 5 === 0 ? 10 : 6));
    return { f, outer, inner, major: i % 5 === 0 };
  });

  // Amber "over" zone at the top of the scale.
  const overStart = tip(OVER_ZONE, NEEDLE_LEN + 4);

  return (
    <div
      className="vu"
      role="meter"
      aria-label="Ranking quality"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg className="vu__face" viewBox="0 0 200 100" aria-hidden="true">
        {/* scale arc */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="var(--engrave)"
          strokeWidth="1.5"
        />
        {/* over zone */}
        <path
          d={`M ${overStart.x} ${overStart.y} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="var(--lamp-amber)"
          strokeWidth="2.5"
          opacity={pinned ? 1 : 0.55}
        />
        {/* ticks */}
        {ticks.map((t) => (
          <line
            key={t.f}
            x1={t.inner.x}
            y1={t.inner.y}
            x2={t.outer.x}
            y2={t.outer.y}
            stroke="var(--ink-soft)"
            strokeWidth={t.major ? 1.4 : 0.8}
            opacity={t.major ? 0.85 : 0.5}
          />
        ))}
        {/* silkscreen VU mark */}
        <text
          x={PIVOT_X}
          y={40}
          textAnchor="middle"
          fontFamily="var(--font-label)"
          fontSize="9"
          letterSpacing="3"
          fill="var(--ink-soft)"
        >
          VU
        </text>
        {/* needle */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
            transition: animate
              ? 'transform 620ms cubic-bezier(0.34, 1.42, 0.64, 1)'
              : 'none',
          }}
        >
          <line
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={PIVOT_X}
            y2={PIVOT_Y - NEEDLE_LEN}
            stroke="var(--lamp-amber)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
        {/* hub */}
        <circle cx={PIVOT_X} cy={PIVOT_Y} r="5" fill="var(--ink)" />
        <circle cx={PIVOT_X} cy={PIVOT_Y} r="2" fill="var(--faceplate-hi)" />
      </svg>
      <div className="vu__footer">
        <span className="vu__legend">Ranked</span>
        <span className="vu__count">
          <span className={`lamp lamp--amber${pinned ? ' is-on' : ''}`} />
          {ranked} / {total || 0}
        </span>
      </div>
    </div>
  );
}
