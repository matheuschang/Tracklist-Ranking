import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragOverEvent,
  type DragStartEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBoard } from '../state/BoardProvider';
import { TIERS, type BoardState } from '../state/boardReducer';
import { TierRow } from './TierRow';
import { TrackBench } from './TrackBench';
import { TrackCardOverlay } from './TrackCard';

type ContainerId = 'bench' | `tier-${number}`;

const TIER_META = [
  { accent: 'var(--tier-s)', empty: 'Reserved for the ones you’d defend to a stranger.' },
  { accent: 'var(--tier-a)', empty: 'Great. It always gets you on the right mood.' },
  { accent: 'var(--tier-b)', empty: 'Solid. You’d never skip these.' },
  { accent: 'var(--tier-c)', empty: 'Fine. Depends on the day.' },
  { accent: 'var(--tier-d)', empty: 'The ones your thumb finds the skip button for.' },
];

function isContainerId(id: UniqueIdentifier): id is ContainerId {
  return typeof id === 'string' && (id === 'bench' || id.startsWith('tier-'));
}
function containerOfTrack(s: BoardState, track: number): ContainerId {
  const t = s.assignment[track];
  return t == null ? 'bench' : (`tier-${t}` as ContainerId);
}
function resolveOverContainer(s: BoardState, overId: UniqueIdentifier): ContainerId | null {
  if (isContainerId(overId)) return overId;
  const asNum = Number(overId);
  if (Number.isNaN(asNum) || asNum < 0 || asNum >= s.assignment.length) return null;
  return containerOfTrack(s, asNum);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Board() {
  const { state, getState, drop, assignTrack, toggleExclude } = useBoard();
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [reduced] = useState(prefersReducedMotion);

  // Collision stabilisation (from dnd-kit's multi-container recipe): keep the
  // last valid target when the pointer briefly leaves every droppable, and
  // suppress a frame of flicker right after a cross-container move.
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewContainer = useRef(false);
  useEffect(() => {
    recentlyMovedToNewContainer.current = false;
  });

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    // Pointer-first: the card lands where the cursor is, independent of the
    // dragged card's own bulk (which closestCorners would let overlap a
    // neighbouring tier).
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    let overId = getFirstCollision(hits, 'id');

    if (overId != null) {
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    if (recentlyMovedToNewContainer.current && activeTrack != null) {
      lastOverId.current = activeTrack;
    }
    // Keyboard sensor / pointer in a gap: fall back to geometry, then memory.
    if (lastOverId.current == null) {
      const geometry = closestCenter(args);
      return geometry.length > 0 ? geometry : [];
    }
    return [{ id: lastOverId.current }];
  }, [activeTrack]);

  // Mouse + Touch kept separate (PointerSensor would grab both and the two
  // gestures fight on phones). Touch needs a press-and-hold so a plain swipe on
  // a card still scrolls the page; mouse drags start after a tiny move.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!state.source) return null;
  const tracks = state.source.tracks;

  function onDragStart(e: DragStartEvent) {
    setActiveTrack(Number(e.active.id));
  }

  // Live cross-container move: hop the card into a new tier as the cursor
  // enters it. Position is resolved inside the reducer from its own current
  // state, so nothing here depends on a stale snapshot mid-drag.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const s = getState();
    const activeId = Number(active.id);
    const overContainer = resolveOverContainer(s, over.id);
    if (!overContainer) return;
    if (containerOfTrack(s, activeId) === overContainer) return;
    recentlyMovedToNewContainer.current = true;
    drop(activeId, over.id);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTrack(null);
    if (!over) return;
    if (over.id === active.id) return; // dropped on itself → no change
    drop(Number(active.id), over.id);
  }

  const activeTrackObj = activeTrack != null ? tracks[activeTrack] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveTrack(null)}
    >
      <div className="board" data-board>
        {TIERS.map((grade, t) => (
          <TierRow
            key={grade}
            tierIndex={t}
            grade={grade}
            accentVar={TIER_META[t].accent}
            emptyLine={TIER_META[t].empty}
            tracks={state.tierOrder[t].map((i) => tracks[i])}
            onAssign={assignTrack}
          />
        ))}
      </div>
      <TrackBench
        tracks={state.benchOrder.map((i) => tracks[i])}
        hasSource={!!state.source}
        excluded={state.excluded}
        onAssign={assignTrack}
        onToggleExclude={toggleExclude}
      />
      <DragOverlay dropAnimation={reduced ? null : undefined}>
        {activeTrackObj ? <TrackCardOverlay track={activeTrackObj} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
