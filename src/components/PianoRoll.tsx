import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { Clip, Action } from '../types';
import {
  PR_NOTE_MIN, PR_NOTE_MAX, PR_NOTE_COUNT, PR_NOTE_HEIGHT,
  PR_KEY_WIDTH, PR_CELL_WIDTH, BEATS_PER_BAR, SUBDIV,
} from '../constants';
import { midiToName, isBlackKey } from '../utils';

interface Props {
  clip: Clip;
  clipId: string;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}

export default function PianoRoll({ clip, clipId, dispatch, onClose }: Props) {
  const totalCells = clip.lengthBeats * SUBDIV;
  const gridWidth = totalCells * PR_CELL_WIDTH;
  const totalWidth = PR_KEY_WIDTH + gridWidth;
  const totalHeight = PR_NOTE_COUNT * PR_NOTE_HEIGHT;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to show C4 on mount
  useEffect(() => {
    if (scrollRef.current) {
      const c4Y = (PR_NOTE_MAX - 1 - 60) * PR_NOTE_HEIGHT;
      scrollRef.current.scrollTop = c4Y - 80;
    }
  }, []);

  const pitchToY = (pitch: number) => (PR_NOTE_MAX - 1 - pitch) * PR_NOTE_HEIGHT;

  const handleGridClick = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellIndex = Math.floor(x / PR_CELL_WIDTH);
    const pitchIndex = Math.floor(y / PR_NOTE_HEIGHT);
    const pitch = PR_NOTE_MAX - 1 - pitchIndex;
    const beatStart = cellIndex / SUBDIV;

    if (pitch < PR_NOTE_MIN || pitch >= PR_NOTE_MAX) return;

    const existing = clip.notes.find(n => {
      const noteStartCell = Math.floor(n.beat * SUBDIV);
      const noteEndCell = Math.floor((n.beat + n.duration) * SUBDIV);
      return cellIndex >= noteStartCell && cellIndex < noteEndCell && n.pitch === pitch;
    });

    if (existing) {
      dispatch({ type: 'REMOVE_NOTE', clipId, noteId: existing.id });
    } else {
      dispatch({ type: 'ADD_NOTE', clipId, note: { pitch, beat: beatStart, duration: 1, velocity: 0.8 } });
    }
  }, [clip.notes, clipId, dispatch]);

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0" style={{ height: 280 }}>
      {/* Header */}
      <div className="flex items-center px-3 gap-2 bg-zinc-900 border-b border-zinc-800 shrink-0" style={{ height: 28 }}>
        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>piano</span>
        <span className="text-xs text-zinc-400 flex-1">Piano Roll</span>
        <span className="text-xs text-zinc-600">Click to add note · Click note to remove</span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors ml-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <svg width={totalWidth} height={totalHeight} className="block select-none">

          {/* Piano keys + row backgrounds */}
          {Array.from({ length: PR_NOTE_COUNT }, (_, i) => {
            const pitch = PR_NOTE_MAX - 1 - i;
            const y = i * PR_NOTE_HEIGHT;
            const black = isBlackKey(pitch);
            const isC = pitch % 12 === 0;

            return (
              <g key={pitch}>
                {/* Key */}
                <rect x={0} y={y} width={PR_KEY_WIDTH} height={PR_NOTE_HEIGHT}
                  fill={black ? '#1c1c24' : '#2a2a30'} stroke="#3f3f46" strokeWidth={0.5} />
                {/* Label for C notes and F notes */}
                {(isC || pitch % 12 === 5) && (
                  <text x={PR_KEY_WIDTH - 5} y={y + PR_NOTE_HEIGHT - 3}
                    textAnchor="end" fill={isC ? '#a78bfa' : '#4b5563'}
                    fontSize={isC ? 10 : 9} fontFamily="Inter, sans-serif">
                    {midiToName(pitch)}
                  </text>
                )}
                {/* Row background in grid area */}
                <rect x={PR_KEY_WIDTH} y={y} width={gridWidth} height={PR_NOTE_HEIGHT}
                  fill={black ? '#0f0f14' : '#141418'} />
              </g>
            );
          })}

          {/* Vertical grid lines */}
          {Array.from({ length: totalCells + 1 }, (_, i) => {
            const x = PR_KEY_WIDTH + i * PR_CELL_WIDTH;
            const isBeat = i % SUBDIV === 0;
            const isBar = i % (SUBDIV * BEATS_PER_BAR) === 0;
            return (
              <line key={i} x1={x} y1={0} x2={x} y2={totalHeight}
                stroke={isBar ? '#3f3f46' : isBeat ? '#2a2a30' : '#1a1a20'} strokeWidth={1} />
            );
          })}

          {/* Horizontal pitch lines */}
          {Array.from({ length: PR_NOTE_COUNT + 1 }, (_, i) => (
            <line key={i} x1={PR_KEY_WIDTH} y1={i * PR_NOTE_HEIGHT}
              x2={PR_KEY_WIDTH + gridWidth} y2={i * PR_NOTE_HEIGHT}
              stroke="#1f1f26" strokeWidth={0.5} />
          ))}

          {/* Transparent click overlay for the grid */}
          <rect
            x={PR_KEY_WIDTH} y={0}
            width={gridWidth} height={totalHeight}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={handleGridClick}
          />

          {/* Notes */}
          {clip.notes.map(note => {
            const y = pitchToY(note.pitch);
            const x = PR_KEY_WIDTH + note.beat * SUBDIV * PR_CELL_WIDTH;
            const w = Math.max(note.duration * SUBDIV * PR_CELL_WIDTH - 2, 4);
            return (
              <rect key={note.id}
                x={x + 1} y={y + 2}
                width={w} height={PR_NOTE_HEIGHT - 3}
                fill="#8b5cf6" rx={2}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  dispatch({ type: 'REMOVE_NOTE', clipId, noteId: note.id });
                }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
