import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Track } from '../providers/types';

interface TrackCardProps {
  track: Track;
  /** direct-assign from keyboard: tier index 0..4, or null for the bench. */
  onAssign?: (tier: number | null) => void;
  /** whether this card is ignored (greyed out, out of the metric). */
  excluded?: boolean;
  /** toggle the ignored state. */
  onToggleExclude?: () => void;
}

function formatDuration(ms: number | null): string | null {
  if (ms == null) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** s a b c d → tier 0..4 ; 0 / backspace / delete → bench. */
function tierForKey(key: string): number | null | undefined {
  switch (key.toLowerCase()) {
    case 's': return 0;
    case 'a': return 1;
    case 'b': return 2;
    case 'c': return 3;
    case 'd': return 4;
    case '0':
    case 'backspace':
    case 'delete': return null;
    default: return undefined;
  }
}

export function TrackCard({ track, onAssign, excluded = false, onToggleExclude }: TrackCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.index });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const duration = formatDuration(track.durationMs);

  // dnd-kit's keyboard sensor lives on listeners.onKeyDown — keep it for
  // space/enter/arrows, and intercept only our own shortcut keys.
  const dndKeyDown = listeners?.onKeyDown as
    | ((e: React.KeyboardEvent) => void)
    | undefined;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key.toLowerCase() === 'x' && onToggleExclude) {
      e.preventDefault();
      onToggleExclude();
      return;
    }
    const tier = tierForKey(e.key);
    if (tier !== undefined && onAssign) {
      e.preventDefault();
      onAssign(tier);
      return;
    }
    dndKeyDown?.(e);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card${isDragging ? ' is-dragging' : ''}${excluded ? ' is-excluded' : ''}`}
      data-track-card
      aria-label={`${track.title}${track.artist ? ', ' + track.artist : ''}`}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
    >
      <div className={`card__art${track.artworkUrl ? '' : ' card__art--type'}`}>
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" crossOrigin="anonymous" draggable={false} />
        ) : (
          <span>{track.title}</span>
        )}
        <span className="card__num">{track.index + 1}</span>
        {onToggleExclude && (
          <button
            type="button"
            className="card__ignore"
            aria-pressed={excluded}
            title={excluded ? 'Count in score' : 'Ignore in score'}
            aria-label={excluded ? 'Count this card in the score' : 'Ignore this card in the score'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExclude();
            }}
          >
            {excluded ? '+' : '⊘'}
          </button>
        )}
      </div>
      <div className="card__meta">
        <div className="card__title" title={track.title}>{track.title}</div>
        {track.artist && <div className="card__artist">{track.artist}</div>}
        {duration && <div className="card__dur">{duration}</div>}
      </div>
    </div>
  );
}

/** Static clone used inside the DragOverlay (no sortable wiring). */
export function TrackCardOverlay({ track }: { track: Track }) {
  const duration = formatDuration(track.durationMs);
  return (
    <div className="card card--overlay" aria-hidden="true">
      <div className={`card__art${track.artworkUrl ? '' : ' card__art--type'}`}>
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" crossOrigin="anonymous" draggable={false} />
        ) : (
          <span>{track.title}</span>
        )}
        <span className="card__num">{track.index + 1}</span>
      </div>
      <div className="card__meta">
        <div className="card__title">{track.title}</div>
        {track.artist && <div className="card__artist">{track.artist}</div>}
        {duration && <div className="card__dur">{duration}</div>}
      </div>
    </div>
  );
}
