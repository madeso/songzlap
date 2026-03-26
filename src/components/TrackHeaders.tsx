import { memo } from 'react';
import type { ChordConfig } from '../types';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addTrack, selectTrack, setInstrument, openInstrument, toggleMute, removeTrack, addChordTrack, setChordConfig } from '../store/slice';
import { RULER_HEIGHT, TRACK_HEIGHT } from '../constants';

const NOTE_DUR_OPTIONS: [number, string][] = [
  [0.25, '1/16'], [0.5, '1/8'], [1, '1/4'], [2, '1/2'], [4, '1/1'],
];
const STYLE_OPTIONS: [ChordConfig['style'], string][] = [
  ['block', 'Block'], ['bass-only', 'Bass'], ['arpeggio-up', 'Arp↑'], ['arpeggio-down', 'Arp↓'], ['strum', 'Strum'],
];

interface Props {
  instrumentsPanelOpen: boolean;
  onCloseInstrumentsPanel: () => void;
}

export default memo(function TrackHeaders({ instrumentsPanelOpen, onCloseInstrumentsPanel }: Props) {
  const dispatch = useAppDispatch()
  const tracks = useAppSelector(s => s.song.tracks)
  const instruments = useAppSelector(s => s.song.instruments)
  const selectedTrackId = useAppSelector(s => s.song.selectedTrackId)
  const openInstrumentId = useAppSelector(s => s.song.openInstrumentId)

  function handleEditInstrument(e: React.MouseEvent, instrumentId: string) {
    e.stopPropagation()
    if (instrumentsPanelOpen && openInstrumentId === instrumentId) {
      dispatch(openInstrument(null))
      onCloseInstrumentsPanel()
    } else {
      dispatch(openInstrument(instrumentId))
      // App's useEffect will open the panel
    }
  }
  return (
    <div className="shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col z-10" style={{ width: 192 }}>
      {/* Ruler spacer + add track */}
      <div
        className="shrink-0 border-b border-zinc-800 flex items-center justify-end px-2"
        style={{ height: RULER_HEIGHT }}
      >
        <button
          onClick={() => dispatch(addTrack())}
          className="text-xs text-zinc-500 hover:text-violet-400 transition-colors flex items-center gap-0.5"
          title="Add track"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          Track
        </button>
      </div>

      {tracks.map(track => {
        const isChord = !!track.chordConfig;
        const cfg = track.chordConfig;
        const sourceTrackName = cfg ? (tracks.find(t => t.id === cfg.sourceTrackId)?.name ?? '?') : '';

        return (
        <div
          key={track.id}
          onClick={() => dispatch(selectTrack(selectedTrackId === track.id ? null : track.id))}
          className={`shrink-0 flex items-center gap-1 border-b border-zinc-800 px-2 cursor-pointer transition-colors ${
            selectedTrackId === track.id ? 'bg-zinc-800' : 'hover:bg-zinc-850'
          }`}
          style={{ height: TRACK_HEIGHT, borderLeftWidth: 3, borderLeftColor: track.color }}
        >
          {isChord && cfg ? (
            <>
              <span className="text-xs text-violet-400 shrink-0" title={`Chords from: ${sourceTrackName}`}>♩</span>
              <span className="text-xs text-zinc-500 truncate shrink" style={{ maxWidth: 36 }} title={sourceTrackName}>{sourceTrackName}</span>

              <select
                value={cfg.noteDuration}
                onClick={e => e.stopPropagation()}
                onChange={e => dispatch(setChordConfig({ trackId: track.id, config: { ...cfg, noteDuration: Number(e.target.value) } }))}
                className="text-xs bg-zinc-800 text-zinc-300 rounded px-0.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500"
                style={{ maxWidth: 40 }}
                title="Note duration"
              >
                {NOTE_DUR_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>

              <select
                value={cfg.octave}
                onClick={e => e.stopPropagation()}
                onChange={e => dispatch(setChordConfig({ trackId: track.id, config: { ...cfg, octave: Number(e.target.value) } }))}
                className="text-xs bg-zinc-800 text-zinc-300 rounded px-0.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500"
                style={{ maxWidth: 34 }}
                title="Octave"
              >
                {[-2,-1,0,1,2].map(o => <option key={o} value={o}>{o >= 0 ? `+${o}` : o}</option>)}
              </select>

              <select
                value={cfg.style}
                onClick={e => e.stopPropagation()}
                onChange={e => dispatch(setChordConfig({ trackId: track.id, config: { ...cfg, style: e.target.value as ChordConfig['style'] } }))}
                className="text-xs bg-zinc-800 text-zinc-300 rounded px-0.5 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500"
                style={{ maxWidth: 46 }}
                title="Style"
              >
                {STYLE_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>

              <button
                onClick={e => { e.stopPropagation(); dispatch(toggleMute(track.id)); }}
                className={`flex items-center justify-center w-5 h-5 rounded transition-colors ml-auto shrink-0 ${track.muted ? 'text-zinc-600' : 'text-zinc-400 hover:text-zinc-200'}`}
                title={track.muted ? 'Unmute' : 'Mute'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{track.muted ? 'volume_off' : 'volume_up'}</span>
              </button>
              <button
                onClick={e => { e.stopPropagation(); dispatch(removeTrack(track.id)); }}
                className="flex items-center justify-center w-5 h-5 shrink-0 text-zinc-700 hover:text-red-400 transition-colors"
                title="Remove track"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-300 truncate flex-1 min-w-0" title={track.name}>{track.name}</span>

              <select
                value={track.instrumentId}
                onClick={e => e.stopPropagation()}
                onChange={e => dispatch(setInstrument({ trackId: track.id, instrumentId: e.target.value }))}
                className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500"
                style={{ maxWidth: 72 }}
              >
                {Object.values(instruments).map(instr => (
                  <option key={instr.id} value={instr.id}>{instr.name}</option>
                ))}
              </select>

              <button
                onClick={e => handleEditInstrument(e, track.instrumentId)}
                className={`flex items-center justify-center w-5 h-5 transition-colors ${
                  instrumentsPanelOpen && openInstrumentId === track.instrumentId
                    ? 'text-violet-400'
                    : 'text-zinc-700 hover:text-violet-400'
                }`}
                title="Edit instrument"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>tune</span>
              </button>

              <button
                onClick={e => { e.stopPropagation(); dispatch(addChordTrack(track.id)); }}
                className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-violet-400 transition-colors"
                title="Generate chord track from this melody"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>piano</span>
              </button>

              <button
                onClick={e => { e.stopPropagation(); dispatch(toggleMute(track.id)); }}
                className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${track.muted ? 'text-zinc-600' : 'text-zinc-400 hover:text-zinc-200'}`}
                title={track.muted ? 'Unmute' : 'Mute'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{track.muted ? 'volume_off' : 'volume_up'}</span>
              </button>

              <button
                onClick={e => { e.stopPropagation(); dispatch(removeTrack(track.id)); }}
                className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-red-400 transition-colors"
                title="Remove track"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </>
          )}
        </div>
        );
      })}
    </div>
  );
});
