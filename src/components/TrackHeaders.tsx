import { memo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addTrack, selectTrack, setInstrument, openInstrument, toggleMute, removeTrack, addChordTrack } from '../store/slice';
import { RULER_HEIGHT, TRACK_HEIGHT } from '../constants';

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
          className="text-xs text-zinc-500 hover:text-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors flex items-center gap-0.5"
          title="Add track"
        >
          <span className="material-symbols-outlined text-sm">add</span>
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
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch(selectTrack(selectedTrackId === track.id ? null : track.id)); } }}
          role="option"
          aria-selected={selectedTrackId === track.id}
          tabIndex={0}
          className={`shrink-0 flex items-center gap-1.5 border-b border-zinc-800 px-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 transition-colors ${
            selectedTrackId === track.id ? 'bg-zinc-800' : 'hover:bg-zinc-800'
          }`}
          style={{ height: TRACK_HEIGHT, borderLeftWidth: 3, borderLeftColor: track.color }}
        >
          {/* Track name / chord badge */}
          {isChord ? (
            <span className="text-xs text-zinc-300 truncate flex-1 min-w-0" title={`Chords from: ${sourceTrackName}`}>
              <span className="text-violet-400 mr-0.5">♩</span>{sourceTrackName}
            </span>
          ) : (
            <span className="text-xs text-zinc-300 truncate flex-1 min-w-0" title={track.name}>{track.name}</span>
          )}

          {/* Instrument selector — all tracks */}
          <select
            value={track.instrumentId}
            onClick={e => e.stopPropagation()}
            onChange={e => dispatch(setInstrument({ trackId: track.id, instrumentId: e.target.value }))}
            className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 max-w-[72px]"
          >
            {Object.values(instruments).map(instr => (
              <option key={instr.id} value={instr.id}>{instr.name}</option>
            ))}
          </select>

          {/* Edit instrument — melody tracks only */}
          {!isChord && (
            <button
              onClick={e => handleEditInstrument(e, track.instrumentId)}
              className={`flex items-center justify-center w-5 h-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors ${
                instrumentsPanelOpen && openInstrumentId === track.instrumentId
                  ? 'text-violet-400'
                  : 'text-zinc-700 hover:text-violet-400'
              }`}
              title="Edit instrument"
            >
              <span className="material-symbols-outlined text-[13px]">tune</span>
            </button>
          )}

          {/* Generate chord track — melody tracks only */}
          {!isChord && (
            <button
              onClick={e => { e.stopPropagation(); dispatch(addChordTrack(track.id)); }}
              className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors"
              title="Generate chord track from this melody"
            >
              <span className="material-symbols-outlined text-[13px]">piano</span>
            </button>
          )}

          <button
            onClick={e => { e.stopPropagation(); dispatch(toggleMute(track.id)); }}
            className={`flex items-center justify-center w-6 h-6 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors ${track.muted ? 'text-zinc-600' : 'text-zinc-400 hover:text-zinc-200'}`}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            <span className="material-symbols-outlined text-sm">{track.muted ? 'volume_off' : 'volume_up'}</span>
          </button>

          <button
            onClick={e => { e.stopPropagation(); dispatch(removeTrack(track.id)); }}
            className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            title="Remove track"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        );
      })}
    </div>
  );
});
