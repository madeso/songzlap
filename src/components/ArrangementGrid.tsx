import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index';
import { openClip, addPlacement, removePlacement, setLoop } from '../store/slice';
import {
  BEATS_PER_BAR, BAR_WIDTH, TRACK_HEIGHT, RULER_HEIGHT,
  ARRANGEMENT_BARS, CLIP_DEFAULT_BEATS, PR_NOTE_MIN, PR_NOTE_MAX,
} from '../constants';

interface Props {
  currentBeat: number;
}

const BEAT_PX = BAR_WIDTH / BEATS_PER_BAR;
const TOTAL_BEATS = ARRANGEMENT_BARS * BEATS_PER_BAR;

export default function ArrangementGrid({ currentBeat }: Props) {
  const dispatch = useAppDispatch()
  const tracks = useAppSelector(s => s.song.tracks)
  const clips = useAppSelector(s => s.song.clips)
  const openClipId = useAppSelector(s => s.song.openClipId)
  const playing = useAppSelector(s => s.song.playing)
  const loopEnabled = useAppSelector(s => s.song.loopEnabled)
  const loopStart = useAppSelector(s => s.song.loopStart)
  const loopEnd = useAppSelector(s => s.song.loopEnd)
  const totalWidth = ARRANGEMENT_BARS * BAR_WIDTH;
  const totalHeight = RULER_HEIGHT + tracks.length * TRACK_HEIGHT;

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - RULER_HEIGHT;
    if (y < 0) return;

    const trackIndex = Math.floor(y / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    const exactBeat = (x / BAR_WIDTH) * BEATS_PER_BAR;

    const hit = track.placements.find(pl => {
      const clip = clips[pl.clipId];
      return clip && exactBeat >= pl.startBeat && exactBeat < pl.startBeat + clip.lengthBeats;
    });

    if (hit) {
      dispatch(openClip(hit.clipId));
    } else {
      const snapBeat = Math.floor(exactBeat / BEATS_PER_BAR) * BEATS_PER_BAR;
      const wouldOverlap = track.placements.some(pl => {
        const clip = clips[pl.clipId];
        if (!clip) return false;
        const newEnd = snapBeat + CLIP_DEFAULT_BEATS;
        return snapBeat < pl.startBeat + clip.lengthBeats && newEnd > pl.startBeat;
      });
      if (!wouldOverlap) {
        dispatch(addPlacement({ trackId: track.id, startBeat: snapBeat }));
      }
    }
  }, [tracks, clips, dispatch]);

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - RULER_HEIGHT;
    if (y < 0) return;

    const trackIndex = Math.floor(y / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    const exactBeat = (x / BAR_WIDTH) * BEATS_PER_BAR;

    const hit = track.placements.find(pl => {
      const clip = clips[pl.clipId];
      return clip && exactBeat >= pl.startBeat && exactBeat < pl.startBeat + clip.lengthBeats;
    });
    if (hit) {
      dispatch(removePlacement({ trackId: track.id, placementId: hit.id }));
    }
  }, [tracks, clips, dispatch]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingMarker, setDraggingMarker] = useState<'start' | 'end' | null>(null);
  // Refs to avoid stale closures in drag effect
  const loopStartRef = useRef(loopStart);
  const loopEndRef = useRef(loopEnd);
  loopStartRef.current = loopStart;
  loopEndRef.current = loopEnd;
  // Suppresses the SVG onClick that fires after a marker drag ends
  const wasDraggingRef = useRef(false);

  useEffect(() => {
    if (!draggingMarker) return;
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const beat = Math.max(0, Math.min(TOTAL_BEATS, Math.round((e.clientX - rect.left) / BEAT_PX)));
      if (draggingMarker === 'start') {
        dispatch(setLoop({ start: Math.min(beat, loopEndRef.current - 1) }));
      } else {
        dispatch(setLoop({ end: Math.max(beat, loopStartRef.current + 1) }));
      }
    };
    const onUp = () => { wasDraggingRef.current = true; setDraggingMarker(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingMarker, dispatch]);

  const startMarkerDrag = useCallback((e: React.MouseEvent, which: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingMarker(which);
  }, []);

  const playheadX = (currentBeat / BEATS_PER_BAR) * BAR_WIDTH;
  const pitchRange = PR_NOTE_MAX - PR_NOTE_MIN;
  const loopStartX = (loopStart / BEATS_PER_BAR) * BAR_WIDTH;
  const loopEndX = (loopEnd / BEATS_PER_BAR) * BAR_WIDTH;

  return (
    <div className="flex-1 overflow-auto">
      <svg
        ref={svgRef}
        width={totalWidth}
        height={Math.max(totalHeight, 1)}
        className="block select-none"
        style={{ cursor: draggingMarker ? 'ew-resize' : 'pointer' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Background */}
        <rect width={totalWidth} height={totalHeight} fill="#09090b" />

        {/* Ruler */}
        <rect width={totalWidth} height={RULER_HEIGHT} fill="#18181b" />
        {Array.from({ length: ARRANGEMENT_BARS }, (_, i) => (
          <g key={i}>
            <line x1={i * BAR_WIDTH} y1={0} x2={i * BAR_WIDTH} y2={RULER_HEIGHT} stroke="#3f3f46" strokeWidth={1} />
            <text x={i * BAR_WIDTH + 4} y={16} fill="#71717a" fontSize={11} fontFamily="Inter, sans-serif">{i + 1}</text>
          </g>
        ))}

        {/* Loop marker drag handles in ruler */}
        {loopEnabled && (() => {
          const th = RULER_HEIGHT; // triangle height
          const tw = 7;            // triangle half-width
          return (
            <>
              {/* Start handle: right-pointing flag */}
              <g style={{ cursor: 'ew-resize' }}
                onMouseDown={e => startMarkerDrag(e, 'start')}
                onClick={e => e.stopPropagation()}>
                <polygon
                  points={`${loopStartX},${th - 2} ${loopStartX},${th - 2 - tw * 2} ${loopStartX + tw},${th - 2 - tw}`}
                  fill="#10b981"
                />
                {/* Wider hit area */}
                <rect x={loopStartX - 2} y={0} width={tw + 6} height={th} fill="transparent" />
              </g>
              {/* End handle: left-pointing flag */}
              <g style={{ cursor: 'ew-resize' }}
                onMouseDown={e => startMarkerDrag(e, 'end')}
                onClick={e => e.stopPropagation()}>
                <polygon
                  points={`${loopEndX},${th - 2} ${loopEndX},${th - 2 - tw * 2} ${loopEndX - tw},${th - 2 - tw}`}
                  fill="#ef4444"
                />
                {/* Wider hit area */}
                <rect x={loopEndX - tw - 4} y={0} width={tw + 6} height={th} fill="transparent" />
              </g>
            </>
          );
        })()}

        {/* Track rows */}
        {tracks.map((track, ti) => {
          const rowY = RULER_HEIGHT + ti * TRACK_HEIGHT;
          return (
            <g key={track.id}>
              {/* Row background */}
              <rect x={0} y={rowY} width={totalWidth} height={TRACK_HEIGHT} fill={ti % 2 === 0 ? '#0c0c0f' : '#09090b'} />

              {/* Beat grid lines */}
              {Array.from({ length: ARRANGEMENT_BARS * BEATS_PER_BAR + 1 }, (_, bi) => {
                const x = bi * (BAR_WIDTH / BEATS_PER_BAR);
                const isBar = bi % BEATS_PER_BAR === 0;
                return (
                  <line key={bi} x1={x} y1={rowY} x2={x} y2={rowY + TRACK_HEIGHT}
                    stroke={isBar ? '#2e2e32' : '#1a1a1d'} strokeWidth={1} />
                );
              })}

              {/* Bottom border */}
              <line x1={0} y1={rowY + TRACK_HEIGHT - 1} x2={totalWidth} y2={rowY + TRACK_HEIGHT - 1} stroke="#27272a" strokeWidth={1} />

              {/* Clips */}
              {track.placements.map(pl => {
                const clip = clips[pl.clipId];
                if (!clip) return null;
                const cx = (pl.startBeat / BEATS_PER_BAR) * BAR_WIDTH;
                const cw = (clip.lengthBeats / BEATS_PER_BAR) * BAR_WIDTH;
                const isOpen = clip.id === openClipId;

                return (
                  <g key={pl.id}>
                    <rect
                      x={cx + 1} y={rowY + 2}
                      width={cw - 2} height={TRACK_HEIGHT - 4}
                      fill={track.color} fillOpacity={0.25}
                      rx={3}
                      stroke={track.color} strokeWidth={isOpen ? 1.5 : 1} strokeOpacity={isOpen ? 1 : 0.6}
                    />
                    {/* Note preview dots */}
                    {clip.notes.map(note => {
                      const nx = cx + 2 + (note.beat / clip.lengthBeats) * (cw - 4);
                      const nw = Math.max((note.duration / clip.lengthBeats) * (cw - 4), 2);
                      const ny = rowY + 4 + ((PR_NOTE_MAX - 1 - note.pitch) / pitchRange) * (TRACK_HEIGHT - 8);
                      return <rect key={note.id} x={nx} y={ny} width={nw} height={2} fill={track.color} opacity={0.9} />;
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Playhead */}
        <line x1={playheadX} y1={0} x2={playheadX} y2={totalHeight}
          stroke="#ef4444" strokeWidth={1.5} style={{ pointerEvents: 'none' }} opacity={playing ? 1 : 0.3} />

        {/* Loop region */}
        {loopEnabled && (
          <>
            <rect x={loopStartX} y={0} width={loopEndX - loopStartX} height={totalHeight}
              fill="#a78bfa" fillOpacity={0.06} style={{ pointerEvents: 'none' }} />
            <line x1={loopStartX} y1={0} x2={loopStartX} y2={totalHeight}
              stroke="#10b981" strokeWidth={1.5} strokeDasharray="4,3" style={{ pointerEvents: 'none' }} />
            <line x1={loopEndX} y1={0} x2={loopEndX} y2={totalHeight}
              stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" style={{ pointerEvents: 'none' }} />
          </>
        )}
      </svg>
    </div>
  );
}
