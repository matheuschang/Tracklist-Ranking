import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Track } from '../providers/types';
import { TrackCard } from './TrackCard';

interface TrackBenchProps {
  tracks: Track[];
  hasSource: boolean;
  excluded: boolean[];
  onAssign: (track: number, tier: number | null) => void;
  onToggleExclude: (track: number) => void;
}

export function TrackBench({ tracks, hasSource, excluded, onAssign, onToggleExclude }: TrackBenchProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bench' });

  return (
    <section className="bench" aria-label="Unranked tracks">
      <div className="bench__header">
        <span className="silk">Bench</span>
        <span className="lamp lamp--teal is-on" />
        <span className="vu__legend">{tracks.length} unranked</span>
      </div>
      <div ref={setNodeRef} className={`bench__well${isOver ? ' is-over' : ''}`}>
        <SortableContext items={tracks.map((t) => t.index)} strategy={rectSortingStrategy}>
          {tracks.length > 0 ? (
            <div className="bench__grid">
              {tracks.map((t) => (
                <TrackCard
                  key={t.index}
                  track={t}
                  excluded={excluded[t.index]}
                  onAssign={(tier) => onAssign(t.index, tier)}
                  onToggleExclude={() => onToggleExclude(t.index)}
                />
              ))}
            </div>
          ) : (
            <p className="bench__empty">
              {hasSource
                ? 'Every track is ranked. Drag one back here to reconsider.'
                : 'No tracks loaded. Paste an album or playlist link above.'}
            </p>
          )}
        </SortableContext>
      </div>
    </section>
  );
}
