import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Track } from '../providers/types';
import { TrackCard } from './TrackCard';

interface TierRowProps {
  tierIndex: number;
  grade: string;
  accentVar: string;
  emptyLine: string;
  tracks: Track[];
  onAssign: (track: number, tier: number | null) => void;
}

export function TierRow({ tierIndex, grade, accentVar, emptyLine, tracks, onAssign }: TierRowProps) {
  const containerId = `tier-${tierIndex}`;
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  const filled = tracks.length > 0;

  return (
    <div className="tier">
      <div className="tier__plate" style={{ '--tier-accent': accentVar } as React.CSSProperties}>
        <span className="tier__grade">{grade}</span>
        <span className="tier__accent" />
        <span className={`lamp lamp--amber${filled ? ' is-on' : ''}`} />
      </div>
      <div ref={setNodeRef} className={`tier__well${isOver ? ' is-over' : ''}`}>
        <SortableContext items={tracks.map((t) => t.index)} strategy={horizontalListSortingStrategy}>
          <div className="tier__lane">
            {filled ? (
              tracks.map((t) => (
                <TrackCard key={t.index} track={t} onAssign={(tier) => onAssign(t.index, tier)} />
              ))
            ) : (
              <span className="tier__empty">{emptyLine}</span>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
