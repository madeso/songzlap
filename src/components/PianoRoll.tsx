import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from '../types';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addNote, removeNote, resizeNote, openClip, transposeClip } from '../store/slice';
import {
  PR_NOTE_MIN, PR_NOTE_MAX, PR_NOTE_COUNT, PR_NOTE_HEIGHT,
  PR_KEY_WIDTH, PR_CELL_WIDTH, BEATS_PER_BAR, SUBDIV,
} from '../constants';
import { midiToName, isBlackKey } from '../utils';

const RESIZE_HANDLE_PX = 8;

const NOTE_LEN_LABELS: [number, string][] = [
  [8, '2/1'], [4, '1/1'], [3, '3/4'], [2, '1/2'],
  [1.5, '3/8'], [1, '1/4'], [0.75, '3/16'], [0.5, '1/8'],
  [0.25, '1/16'], [0.125, '1/32'],
];

function fmtLen(beats: number): string {
  const match = NOTE_LEN_LABELS.find(([b]) => Math.abs(b - beats) < 0.01);
  return match ? match[1] : `${+beats.toFixed(3)}b`;
}

type DragState =
  | { kind: 'drawing'; pitch: number; startCell: number; endCell: number }
  | { kind: 'resizing'; noteId: string; noteBeat: number; origDurCells: number; curDurCells: number; startX: number }
  | { kind: 'removing'; noteId: string; startX: number };

export default function PianoRoll({ currentBeat }: { currentBeat: number }) {
  const dispatch = useAppDispatch()
  const clipId = useAppSelector(s => s.song.openClipId)!
  const clip = useAppSelector(s => s.song.clips[clipId])
  const tracks = useAppSelector(s => s.song.tracks)
  const totalCells = (clip?.lengthBeats ?? 0) * SUBDIV;
  const gridWidth = totalCells * PR_CELL_WIDTH;
  const totalHeight = PR_NOTE_COUNT * PR_NOTE_HEIGHT;

  const pianoRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastDurRef = useRef<number>(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [lastDur, setLastDur] = useState<number>(1);
  const [cursor, setCursor] = useState<string>('crosshair');

  useEffect(() => {
    const c4Y = (PR_NOTE_MAX - 1 - 60) * PR_NOTE_HEIGHT;
    const top = c4Y - 80;
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = top;
    if (pianoRef.current) pianoRef.current.scrollTop = top;
  }, []);

  // Keep piano keys in sync with grid vertical scroll
  const handleGridScroll = () => {
    if (pianoRef.current && gridScrollRef.current) {
      pianoRef.current.scrollTop = gridScrollRef.current.scrollTop;
    }
  };

  const pitchToY = (pitch: number) => (PR_NOTE_MAX - 1 - pitch) * PR_NOTE_HEIGHT;

  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // Grid SVG has no PR_KEY_WIDTH offset — x=0 is beat 0
  const findNoteAt = useCallback((svgX: number, svgY: number): Note | undefined => {
    const cell = Math.floor(svgX / PR_CELL_WIDTH);
    const pitch = PR_NOTE_MAX - 1 - Math.floor(svgY / PR_NOTE_HEIGHT);
    return clip.notes.find(n => {
      const startCell = Math.round(n.beat * SUBDIV);
      const endCell = startCell + Math.max(1, Math.round(n.duration * SUBDIV));
      return n.pitch === pitch && cell >= startCell && cell < endCell;
    });
  }, [clip.notes]);

  // Global drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const svgX = e.clientX - rect.left;

      if (ds.kind === 'drawing') {
        const raw = Math.floor(svgX / PR_CELL_WIDTH);
        const endCell = Math.max(ds.startCell, Math.min(totalCells - 1, raw));
        if (endCell !== ds.endCell) {
          const next = { ...ds, endCell };
          dragRef.current = next;
          setDragState(next);
        }
      } else if (ds.kind === 'resizing') {
        const deltaCells = Math.round((svgX - ds.startX) / PR_CELL_WIDTH);
        const newCells = Math.max(1, ds.origDurCells + deltaCells);
        if (newCells !== ds.curDurCells) {
          const next = { ...ds, curDurCells: newCells };
          dragRef.current = next;
          setDragState(next);
        }
      }
    };

    const onUp = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      dragRef.current = null;
      setDragState(null);
      setCursor('crosshair');
      const rect = svgRef.current?.getBoundingClientRect();
      const svgX = rect ? e.clientX - rect.left : 0;

      if (ds.kind === 'drawing') {
        // Click with no drag → use last duration; drag → spanned duration
        const duration = ds.endCell > ds.startCell
          ? (ds.endCell - ds.startCell + 1) / SUBDIV
          : lastDurRef.current;
        lastDurRef.current = duration;
        setLastDur(duration);
        dispatch(addNote({ clipId, note: { pitch: ds.pitch, beat: ds.startCell / SUBDIV, duration, velocity: 0.8 } }));
      } else if (ds.kind === 'resizing') {
        const duration = ds.curDurCells / SUBDIV;
        lastDurRef.current = duration;
        setLastDur(duration);
        dispatch(resizeNote({ clipId, noteId: ds.noteId, duration }));
      } else if (ds.kind === 'removing') {
        if (Math.abs(svgX - ds.startX) < 4) {
          dispatch(removeNote({ clipId, noteId: ds.noteId }));
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clipId, dispatch, totalCells]);

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (dragRef.current) return;
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const note = findNoteAt(coords.x, coords.y);
    if (note) {
      const noteEndX = (note.beat + note.duration) * SUBDIV * PR_CELL_WIDTH;
      setCursor(noteEndX - coords.x <= RESIZE_HANDLE_PX ? 'ew-resize' : 'pointer');
    } else {
      setCursor('crosshair');
    }
  }, [getSvgCoords, findNoteAt]);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x: svgX, y: svgY } = coords;
    const cell = Math.floor(svgX / PR_CELL_WIDTH);
    const pitch = PR_NOTE_MAX - 1 - Math.floor(svgY / PR_NOTE_HEIGHT);

    if (cell < 0 || cell >= totalCells || pitch < PR_NOTE_MIN || pitch >= PR_NOTE_MAX) return;

    const note = findNoteAt(svgX, svgY);
    if (note) {
      const noteEndX = (note.beat + note.duration) * SUBDIV * PR_CELL_WIDTH;
      if (noteEndX - svgX <= RESIZE_HANDLE_PX) {
        const origDurCells = Math.max(1, Math.round(note.duration * SUBDIV));
        const ds: DragState = { kind: 'resizing', noteId: note.id, noteBeat: note.beat, origDurCells, curDurCells: origDurCells, startX: svgX };
        dragRef.current = ds;
        setDragState(ds);
        setCursor('ew-resize');
      } else {
        const ds: DragState = { kind: 'removing', noteId: note.id, startX: svgX };
        dragRef.current = ds;
        setDragState(ds);
      }
    } else {
      const ds: DragState = { kind: 'drawing', pitch, startCell: cell, endCell: cell };
      dragRef.current = ds;
      setDragState(ds);
    }
  }, [getSvgCoords, findNoteAt, totalCells]);

  const renderNote = (note: Note) => {
    let durCells = Math.max(1, Math.round(note.duration * SUBDIV));
    if (dragState?.kind === 'resizing' && dragState.noteId === note.id) {
      durCells = dragState.curDurCells;
    }
    const isRemoving = dragState?.kind === 'removing' && dragState.noteId === note.id;
    const y = pitchToY(note.pitch);
    const x = note.beat * SUBDIV * PR_CELL_WIDTH;
    const totalW = durCells * PR_CELL_WIDTH - 2;
    const bodyW = Math.max(totalW - RESIZE_HANDLE_PX, 2);
    const handleW = Math.min(RESIZE_HANDLE_PX, totalW) - 1;

    return (
      <g key={note.id} style={{ pointerEvents: 'none' }}>
        <rect
          x={x + 1} y={y + 2}
          width={bodyW} height={PR_NOTE_HEIGHT - 3}
          fill={isRemoving ? '#6d28d9' : '#8b5cf6'}
          rx={2}
        />
        <rect
          x={x + 1 + bodyW} y={y + 2}
          width={handleW} height={PR_NOTE_HEIGHT - 3}
          fill="#a78bfa"
          rx={2}
        />
      </g>
    );
  };

  const renderGhost = () => {
    if (!dragState || dragState.kind !== 'drawing') return null;
    const { pitch, startCell, endCell } = dragState;
    const y = pitchToY(pitch);
    const x = startCell * PR_CELL_WIDTH;
    const w = (endCell - startCell + 1) * PR_CELL_WIDTH - 2;
    return (
      <rect
        x={x + 1} y={y + 2}
        width={Math.max(w, 4)} height={PR_NOTE_HEIGHT - 3}
        fill="#8b5cf6" opacity={0.45} rx={2}
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  if (!clip) return null;

  // Playhead within this clip
  const placement = tracks.flatMap(t => t.placements).find(p => p.clipId === clipId);
  const clipRelativeBeat = placement ? currentBeat - placement.startBeat : -1;
  const showPlayhead = clipRelativeBeat >= 0 && clipRelativeBeat <= clip.lengthBeats;
  const playheadX = clipRelativeBeat * SUBDIV * PR_CELL_WIDTH;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0" style={{ height: 280 }}>
      {/* Header */}
      <div className="flex items-center px-3 gap-2 bg-zinc-900 border-b border-zinc-800 shrink-0" style={{ height: 28 }}>
        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>piano</span>
        <span className="text-xs text-zinc-400 flex-1">Piano Roll</span>
        <span className="text-xs text-zinc-500 tabular-nums" title="Current note length">
          <span className="text-zinc-600 mr-1">len</span>{fmtLen(lastDur)}
        </span>
        <span className="text-xs text-zinc-600">Drag to draw · Drag right edge to resize · Click note to remove</span>
        <div className="flex items-center gap-0.5 ml-2">
          <button
            title="Transpose down one octave"
            onClick={() => dispatch(transposeClip({ clipId, semitones: -12 }))}
            className="flex items-center justify-center px-1.5 h-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-bold tabular-nums"
          >oct−</button>
          <button
            title="Transpose up one octave"
            onClick={() => dispatch(transposeClip({ clipId, semitones: 12 }))}
            className="flex items-center justify-center w-6 h-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-bold tabular-nums"
          >oct−</button>
          <button
            title="Transpose up one octave"
            onClick={() => dispatch(transposeClip({ clipId, semitones: 12 }))}
            className="flex items-center justify-center px-1.5 h-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-bold tabular-nums"
          >oct+</button>
        </div>
        <button onClick={() => dispatch(openClip(null))} className="text-zinc-600 hover:text-zinc-300 transition-colors ml-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Body: fixed piano keys + scrollable grid */}
      <div className="flex-1 flex overflow-hidden">

        {/* Piano keys — never scrolls horizontally; vertical scroll synced with grid */}
        <div ref={pianoRef} style={{ width: PR_KEY_WIDTH, flexShrink: 0, overflowY: 'hidden', overflowX: 'hidden' }}>
          <svg width={PR_KEY_WIDTH} height={totalHeight} className="block select-none">
            {Array.from({ length: PR_NOTE_COUNT }, (_, i) => {
              const pitch = PR_NOTE_MAX - 1 - i;
              const y = i * PR_NOTE_HEIGHT;
              const black = isBlackKey(pitch);
              const isC = pitch % 12 === 0;
              return (
                <g key={pitch}>
                  <rect x={0} y={y} width={PR_KEY_WIDTH} height={PR_NOTE_HEIGHT}
                    fill={black ? '#1c1c24' : '#2a2a30'} stroke="#3f3f46" strokeWidth={0.5} />
                  {(isC || pitch % 12 === 5) && (
                    <text x={PR_KEY_WIDTH - 5} y={y + PR_NOTE_HEIGHT - 3}
                      textAnchor="end" fill={isC ? '#a78bfa' : '#4b5563'}
                      fontSize={isC ? 10 : 9} fontFamily="Inter, sans-serif">
                      {midiToName(pitch)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Grid — scrolls in both directions */}
        <div ref={gridScrollRef} className="flex-1 overflow-auto" onScroll={handleGridScroll}>
          <svg ref={svgRef} width={gridWidth} height={totalHeight} className="block select-none">

            {/* Row backgrounds */}
            {Array.from({ length: PR_NOTE_COUNT }, (_, i) => {
              const pitch = PR_NOTE_MAX - 1 - i;
              const y = i * PR_NOTE_HEIGHT;
              const black = isBlackKey(pitch);
              return (
                <rect key={pitch} x={0} y={y} width={gridWidth} height={PR_NOTE_HEIGHT}
                  fill={black ? '#0f0f14' : '#141418'} />
              );
            })}

            {/* Vertical grid lines */}
            {Array.from({ length: totalCells + 1 }, (_, i) => {
              const x = i * PR_CELL_WIDTH;
              const isBeat = i % SUBDIV === 0;
              const isBar = i % (SUBDIV * BEATS_PER_BAR) === 0;
              return (
                <line key={i} x1={x} y1={0} x2={x} y2={totalHeight}
                  stroke={isBar ? '#3f3f46' : isBeat ? '#2a2a30' : '#1a1a20'} strokeWidth={1} />
              );
            })}

            {/* Horizontal pitch lines */}
            {Array.from({ length: PR_NOTE_COUNT + 1 }, (_, i) => (
              <line key={i} x1={0} y1={i * PR_NOTE_HEIGHT}
                x2={gridWidth} y2={i * PR_NOTE_HEIGHT}
                stroke="#1f1f26" strokeWidth={0.5} />
            ))}

            {/* Notes */}
            {clip.notes.map(renderNote)}

            {/* Ghost preview while drawing */}
            {renderGhost()}

            {/* Playhead */}
            {showPlayhead && (
              <line
                x1={playheadX} y1={0} x2={playheadX} y2={totalHeight}
                stroke="#ef4444" strokeWidth={1.5} opacity={0.85}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Interaction overlay — on top */}
            <rect
              x={0} y={0}
              width={gridWidth} height={totalHeight}
              fill="transparent"
              style={{ cursor }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseLeave={() => { if (!dragRef.current) setCursor('crosshair'); }}
            />
          </svg>
        </div>

      </div>
    </div>
  );
}

