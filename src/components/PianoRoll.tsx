import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, ChordConfig } from '../types';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addNote, removeNote, resizeNote, updateNotes, openClip, transposeClip, setChordConfig } from '../store/slice';
import {
  PR_NOTE_HEIGHT,
  PR_KEY_WIDTH, PR_CELL_WIDTH, BEATS_PER_BAR, SUBDIV,
} from '../constants';
import { midiToName, isBlackKey, computeDisplayRange } from '../utils';

const NOTE_DUR_OPTIONS: [number, string][] = [
  [0.25, '1/16'], [0.5, '1/8'], [1, '1/4'], [2, '1/2'], [4, '1/1'],
];
const STYLE_OPTIONS: [ChordConfig['style'], string][] = [
  ['block', 'Block'], ['bass-only', 'Bass'], ['arpeggio-up', 'Arp↑'], ['arpeggio-down', 'Arp↓'], ['strum', 'Strum'],
];

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
  | { kind: 'resize-right'; noteId: string; origDurCells: number; curDurCells: number; startX: number }
  | { kind: 'resize-left'; noteId: string; origBeat: number; origDuration: number; startX: number; curBeat: number; curDuration: number }
  | { kind: 'moving'; noteId: string; noteIds: string[]; origBeats: Record<string, number>; origPitches: Record<string, number>; startX: number; startY: number; dx: number; dy: number; hasMoved: boolean; wasSelected: boolean };

export default function PianoRoll({ currentBeat }: { currentBeat: number }) {
  const dispatch = useAppDispatch()
  const clipId = useAppSelector(s => s.song.openClipId)!
  const clip = useAppSelector(s => s.song.clips[clipId])
  const tracks = useAppSelector(s => s.song.tracks)

  // Detect if this clip belongs to a chord track
  const chordTrack = tracks.find(t => t.chordConfig && t.placements.some(p => p.clipId === clipId));
  const isChord = !!chordTrack;
  const chordCfg = chordTrack?.chordConfig;

  const { displayMin, displayMax } = computeDisplayRange(clip?.notes ?? []);
  const noteCount = displayMax - displayMin;
  const totalCells = (clip?.lengthBeats ?? 0) * SUBDIV;
  const gridWidth = totalCells * PR_CELL_WIDTH;
  const totalHeight = noteCount * PR_NOTE_HEIGHT;

  const pianoRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastDurRef = useRef<number>(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [lastDur, setLastDur] = useState<number>(1);
  const [cursor, setCursor] = useState<string>('crosshair');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Refs so callbacks always see the latest display range without stale closures
  const displayMaxRef = useRef(displayMax);
  const displayMinRef = useRef(displayMin);
  useEffect(() => {
    displayMaxRef.current = displayMax;
    displayMinRef.current = displayMin;
  });

  // Keep selection in sync: remove IDs that no longer exist in the clip
  const selectedRef = useRef(selectedNoteIds);
  useEffect(() => { selectedRef.current = selectedNoteIds; });

  // Scroll to center of the display range on first mount only
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollDone.current) return;
    initialScrollDone.current = true;
    const midPitch = Math.round((displayMin + displayMax - 1) / 2);
    const top = Math.max(0, (displayMax - 1 - midPitch) * PR_NOTE_HEIGHT - 110);
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = top;
    if (pianoRef.current) pianoRef.current.scrollTop = top;
  });

  // Keep piano keys in sync with grid vertical scroll
  const handleGridScroll = () => {
    if (pianoRef.current && gridScrollRef.current) {
      pianoRef.current.scrollTop = gridScrollRef.current.scrollTop;
    }
  };

  // Delete selected notes when Delete/Backspace is pressed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const sel = selectedRef.current;
      if (sel.size === 0) return;
      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      sel.forEach(noteId => dispatch(removeNote({ clipId, noteId })));
      setSelectedNoteIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipId, dispatch]);

  const pitchToY = (pitch: number) => (displayMax - 1 - pitch) * PR_NOTE_HEIGHT;

  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const findNoteAt = useCallback((svgX: number, svgY: number): Note | undefined => {
    const cell = Math.floor(svgX / PR_CELL_WIDTH);
    const pitch = displayMaxRef.current - 1 - Math.floor(svgY / PR_NOTE_HEIGHT);
    return clip.notes.find(n => {
      const startCell = Math.round(n.beat * SUBDIV);
      const endCell = startCell + Math.max(1, Math.round(n.duration * SUBDIV));
      return n.pitch === pitch && cell >= startCell && cell < endCell;
    });
  }, [clip.notes]);

  // Classify where in a note the click landed
  type NoteZone = 'left-handle' | 'right-handle' | 'body';
  const getNoteZone = useCallback((note: Note, svgX: number): NoteZone => {
    const noteStartX = note.beat * SUBDIV * PR_CELL_WIDTH;
    const noteEndX = (note.beat + note.duration) * SUBDIV * PR_CELL_WIDTH;
    const noteWidth = noteEndX - noteStartX;
    if (svgX - noteStartX <= RESIZE_HANDLE_PX && noteWidth > RESIZE_HANDLE_PX * 2) return 'left-handle';
    if (noteEndX - svgX <= RESIZE_HANDLE_PX) return 'right-handle';
    return 'body';
  }, []);

  // Global drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;

      if (ds.kind === 'drawing') {
        const raw = Math.floor(svgX / PR_CELL_WIDTH);
        const endCell = Math.max(ds.startCell, Math.min(totalCells - 1, raw));
        if (endCell !== ds.endCell) {
          const next = { ...ds, endCell };
          dragRef.current = next;
          setDragState(next);
        }
      } else if (ds.kind === 'resize-right') {
        const deltaCells = Math.round((svgX - ds.startX) / PR_CELL_WIDTH);
        const newCells = Math.max(1, ds.origDurCells + deltaCells);
        if (newCells !== ds.curDurCells) {
          const next = { ...ds, curDurCells: newCells };
          dragRef.current = next;
          setDragState(next);
        }
      } else if (ds.kind === 'resize-left') {
        const deltaCells = Math.round((svgX - ds.startX) / PR_CELL_WIDTH);
        const rightEdge = ds.origBeat + ds.origDuration;
        const newBeat = Math.max(0, Math.min(rightEdge - 1 / SUBDIV, ds.origBeat + deltaCells / SUBDIV));
        const newDuration = rightEdge - newBeat;
        if (Math.abs(newBeat - ds.curBeat) > 0.0001) {
          const next = { ...ds, curBeat: newBeat, curDuration: newDuration };
          dragRef.current = next;
          setDragState(next);
        }
      } else if (ds.kind === 'moving') {
        const dx = Math.round((svgX - ds.startX) / PR_CELL_WIDTH);
        const dy = Math.round((svgY - ds.startY) / PR_NOTE_HEIGHT);
        if (dx !== ds.dx || dy !== ds.dy) {
          const hasMoved = ds.hasMoved || dx !== 0 || dy !== 0;
          const next = { ...ds, dx, dy, hasMoved };
          dragRef.current = next;
          setDragState(next);
          if (hasMoved) setCursor('grabbing');
        }
      }
    };

    const onUp = (_e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      dragRef.current = null;
      setDragState(null);
      setCursor('crosshair');

      if (ds.kind === 'drawing') {
        const duration = ds.endCell > ds.startCell
          ? (ds.endCell - ds.startCell + 1) / SUBDIV
          : lastDurRef.current;
        lastDurRef.current = duration;
        setLastDur(duration);
        dispatch(addNote({ clipId, note: { pitch: ds.pitch, beat: ds.startCell / SUBDIV, duration, velocity: 0.8 } }));
      } else if (ds.kind === 'resize-right') {
        const duration = ds.curDurCells / SUBDIV;
        lastDurRef.current = duration;
        setLastDur(duration);
        dispatch(resizeNote({ clipId, noteId: ds.noteId, duration }));
      } else if (ds.kind === 'resize-left') {
        dispatch(updateNotes({ clipId, updates: [{ noteId: ds.noteId, beat: ds.curBeat, duration: ds.curDuration }] }));
      } else if (ds.kind === 'moving') {
        if (ds.hasMoved) {
          // Commit move for all notes in the move set
          const updates = ds.noteIds.map(nid => {
            const origBeat = ds.origBeats[nid];
            const origPitch = ds.origPitches[nid];
            const newBeat = Math.max(0, origBeat + ds.dx / SUBDIV);
            const newPitch = Math.max(0, Math.min(127, origPitch - ds.dy));
            return { noteId: nid, beat: newBeat, pitch: newPitch };
          });
          dispatch(updateNotes({ clipId, updates }));
        } else {
          // Plain click: update selection
          setSelectedNoteIds(new Set([ds.noteId]));
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
      const zone = getNoteZone(note, coords.x);
      if (zone === 'left-handle') setCursor('w-resize');
      else if (zone === 'right-handle') setCursor('e-resize');
      else setCursor('grab');
    } else {
      setCursor('crosshair');
    }
  }, [getSvgCoords, findNoteAt, getNoteZone]);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x: svgX, y: svgY } = coords;
    const cell = Math.floor(svgX / PR_CELL_WIDTH);
    const pitch = displayMaxRef.current - 1 - Math.floor(svgY / PR_NOTE_HEIGHT);

    if (cell < 0 || cell >= totalCells) return;

    const note = findNoteAt(svgX, svgY);
    if (note) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: delete immediately
        dispatch(removeNote({ clipId, noteId: note.id }));
        setSelectedNoteIds(prev => { const next = new Set(prev); next.delete(note.id); return next; });
        return;
      }

      if (e.shiftKey) {
        // Shift+click: toggle in selection, no drag
        setSelectedNoteIds(prev => {
          const next = new Set(prev);
          if (next.has(note.id)) next.delete(note.id);
          else next.add(note.id);
          return next;
        });
        return;
      }

      const zone = getNoteZone(note, svgX);
      if (zone === 'left-handle') {
        const ds: DragState = { kind: 'resize-left', noteId: note.id, origBeat: note.beat, origDuration: note.duration, startX: svgX, curBeat: note.beat, curDuration: note.duration };
        dragRef.current = ds;
        setDragState(ds);
        setCursor('w-resize');
      } else if (zone === 'right-handle') {
        const origDurCells = Math.max(1, Math.round(note.duration * SUBDIV));
        const ds: DragState = { kind: 'resize-right', noteId: note.id, origDurCells, curDurCells: origDurCells, startX: svgX };
        dragRef.current = ds;
        setDragState(ds);
        setCursor('e-resize');
      } else {
        // Body: start a potential move drag
        const wasSelected = selectedRef.current.has(note.id);
        // Determine which notes will move: the selection if note is in it, else just this note
        const moveIds = wasSelected ? Array.from(selectedRef.current) : [note.id];
        const origBeats: Record<string, number> = {};
        const origPitches: Record<string, number> = {};
        for (const nid of moveIds) {
          const n = clip.notes.find(nn => nn.id === nid);
          if (n) { origBeats[nid] = n.beat; origPitches[nid] = n.pitch; }
        }
        const ds: DragState = { kind: 'moving', noteId: note.id, noteIds: moveIds, origBeats, origPitches, startX: svgX, startY: svgY, dx: 0, dy: 0, hasMoved: false, wasSelected };
        dragRef.current = ds;
        setDragState(ds);
        setCursor('grab');
      }
    } else {
      // Empty area: draw new note, clear selection
      setSelectedNoteIds(new Set());
      const ds: DragState = { kind: 'drawing', pitch, startCell: cell, endCell: cell };
      dragRef.current = ds;
      setDragState(ds);
    }
  }, [getSvgCoords, findNoteAt, getNoteZone, totalCells, clipId, dispatch, clip.notes]);

  const handleOverlayDoubleClick = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    e.preventDefault();
    // Cancel any drag that the first mousedown may have started
    dragRef.current = null;
    setDragState(null);
    const coords = getSvgCoords(e.clientX, e.clientY);
    if (!coords) return;
    const note = findNoteAt(coords.x, coords.y);
    if (note) {
      dispatch(removeNote({ clipId, noteId: note.id }));
      setSelectedNoteIds(prev => { const next = new Set(prev); next.delete(note.id); return next; });
    }
  }, [getSvgCoords, findNoteAt, clipId, dispatch]);

  const renderNote = (note: Note) => {
    let durCells = Math.max(1, Math.round(note.duration * SUBDIV));
    let noteX = note.beat * SUBDIV * PR_CELL_WIDTH;

    if (dragState?.kind === 'resize-right' && dragState.noteId === note.id) {
      durCells = dragState.curDurCells;
    } else if (dragState?.kind === 'resize-left' && dragState.noteId === note.id) {
      noteX = dragState.curBeat * SUBDIV * PR_CELL_WIDTH;
      durCells = Math.max(1, Math.round(dragState.curDuration * SUBDIV));
    }

    let renderPitch = note.pitch;
    let renderBeat = note.beat;
    if (dragState?.kind === 'moving' && dragState.noteIds.includes(note.id)) {
      renderBeat = Math.max(0, dragState.origBeats[note.id] + dragState.dx / SUBDIV);
      renderPitch = Math.max(0, Math.min(127, dragState.origPitches[note.id] - dragState.dy));
      noteX = renderBeat * SUBDIV * PR_CELL_WIDTH;
    }

    const isOutOfRange = renderPitch < displayMin || renderPitch >= displayMax;
    const isSelected = selectedNoteIds.has(note.id) && !isChord;
    let bodyColor: string;
    let handleColor: string;
    if (isChord) {
      bodyColor = '#71717a';
      handleColor = '#a1a1aa';
    } else if (isOutOfRange) {
      bodyColor = '#f97316';
      handleColor = '#fb923c';
    } else if (isSelected) {
      bodyColor = '#a78bfa';  // brighter violet when selected
      handleColor = '#c4b5fd';
    } else {
      bodyColor = '#8b5cf6';
      handleColor = '#a78bfa';
    }
    const opacity = isChord ? 0.55 : 1;

    // Clamp rendering to visible range
    const renderY = isOutOfRange
      ? Math.max(0, Math.min(totalHeight - PR_NOTE_HEIGHT, pitchToY(Math.max(displayMin, Math.min(displayMax - 1, renderPitch)))))
      : pitchToY(renderPitch);

    const totalW = durCells * PR_CELL_WIDTH - 2;
    const bodyW = Math.max(totalW - (isChord ? 0 : RESIZE_HANDLE_PX), 2);
    const handleW = isChord ? 0 : Math.min(RESIZE_HANDLE_PX, totalW) - 1;

    return (
      <g key={note.id} style={{ pointerEvents: 'none' }} opacity={opacity}>
        <rect
          x={noteX + 1} y={renderY + 2}
          width={bodyW} height={PR_NOTE_HEIGHT - 3}
          fill={bodyColor}
          rx={2}
        />
        {isSelected && (
          <rect
            x={noteX + 1} y={renderY + 2}
            width={totalW} height={PR_NOTE_HEIGHT - 3}
            fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}
            rx={2}
          />
        )}
        <rect
          x={noteX + 1 + bodyW} y={renderY + 2}
          width={handleW} height={PR_NOTE_HEIGHT - 3}
          fill={handleColor}
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
      {/* Chord settings bar — shown above the header when a chord clip is open */}
      {isChord && chordCfg && (
        <div className="flex items-center px-3 gap-2 bg-zinc-900 border-b border-zinc-700 shrink-0" style={{ height: 28 }}>
          <span className="text-xs text-violet-400 mr-1">♩ Chord</span>

          <label className="text-xs text-zinc-500">Duration</label>
          <select
            value={chordCfg.noteDuration}
            onChange={e => dispatch(setChordConfig({ trackId: chordTrack.id, config: { ...chordCfg, noteDuration: Number(e.target.value) } }))}
            className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0 border border-zinc-700 focus:outline-none focus:border-violet-500"
          >
            {NOTE_DUR_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>

          <label className="text-xs text-zinc-500">Octave</label>
          <select
            value={chordCfg.octave}
            onChange={e => dispatch(setChordConfig({ trackId: chordTrack.id, config: { ...chordCfg, octave: Number(e.target.value) } }))}
            className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0 border border-zinc-700 focus:outline-none focus:border-violet-500"
          >
            {[-2,-1,0,1,2].map(o => <option key={o} value={o}>{o >= 0 ? `+${o}` : o}</option>)}
          </select>

          <label className="text-xs text-zinc-500">Style</label>
          <select
            value={chordCfg.style}
            onChange={e => dispatch(setChordConfig({ trackId: chordTrack.id, config: { ...chordCfg, style: e.target.value as ChordConfig['style'] } }))}
            className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0 border border-zinc-700 focus:outline-none focus:border-violet-500"
          >
            {STYLE_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>

          <span className="flex-1" />
          <span className="text-xs text-zinc-600 italic">read-only</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-3 gap-2 bg-zinc-900 border-b border-zinc-800 shrink-0" style={{ height: 28 }}>
        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>piano</span>
        <span className="text-xs text-zinc-400 flex-1">Piano Roll</span>
        {!isChord && (
          <>
            <span className="text-xs text-zinc-500 tabular-nums" title="Current note length">
              <span className="text-zinc-600 mr-1">len</span>{fmtLen(lastDur)}
            </span>
            {selectedNoteIds.size > 0 && (
              <span className="text-xs text-violet-400 tabular-nums">{selectedNoteIds.size} selected</span>
            )}
            <span className="text-xs text-zinc-600">Draw · Drag to move · ⇥ edges to resize · Ctrl+click or Del to delete</span>
            <div className="flex items-center gap-0.5 ml-2">
              <button
                title="Transpose down one octave"
                onClick={() => dispatch(transposeClip({ clipId, semitones: -12 }))}
                className="flex items-center justify-center px-1.5 h-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-bold tabular-nums"
              >oct−</button>
              <button
                title="Transpose up one octave"
                onClick={() => dispatch(transposeClip({ clipId, semitones: 12 }))}
                className="flex items-center justify-center px-1.5 h-5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-bold tabular-nums"
              >oct+</button>
            </div>
          </>
        )}
        <button onClick={() => dispatch(openClip(null))} className="text-zinc-600 hover:text-zinc-300 transition-colors ml-2">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Body: fixed piano keys + scrollable grid */}
      <div className="flex-1 flex overflow-hidden">

        {/* Piano keys — never scrolls horizontally; vertical scroll synced with grid */}
        <div ref={pianoRef} style={{ width: PR_KEY_WIDTH, flexShrink: 0, overflowY: 'hidden', overflowX: 'hidden' }}>
          <svg width={PR_KEY_WIDTH} height={totalHeight} className="block select-none">
            {Array.from({ length: noteCount }, (_, i) => {
              const pitch = displayMax - 1 - i;
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
            {Array.from({ length: noteCount }, (_, i) => {
              const pitch = displayMax - 1 - i;
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
            {Array.from({ length: noteCount + 1 }, (_, i) => (
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

            {/* Interaction overlay — melody tracks only */}
            {!isChord && (
              <rect
                x={0} y={0}
                width={gridWidth} height={totalHeight}
                fill="transparent"
                style={{ cursor }}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onDoubleClick={handleOverlayDoubleClick}
                onMouseLeave={() => { if (!dragRef.current) setCursor('crosshair'); }}
              />
            )}
          </svg>
        </div>

      </div>
    </div>
  );
}
