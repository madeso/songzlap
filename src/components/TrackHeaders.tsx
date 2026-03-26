import { memo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addTrack, selectTrack, setInstrument, openInstrument, toggleMute, removeTrack } from '../store/slice';
import { RULER_HEIGHT, TRACK_HEIGHT } from '../constants';

export default memo(function TrackHeaders() {
  const dispatch = useAppDispatch()
  const tracks = useAppSelector(s => s.song.tracks)
  const instruments = useAppSelector(s => s.song.instruments)
  const selectedTrackId = useAppSelector(s => s.song.selectedTrackId)
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

      {tracks.map(track => (
        <div
          key={track.id}
          onClick={() => dispatch(selectTrack(selectedTrackId === track.id ? null : track.id))}
          className={`shrink-0 flex items-center gap-1.5 border-b border-zinc-800 px-2 cursor-pointer transition-colors ${
            selectedTrackId === track.id ? 'bg-zinc-800' : 'hover:bg-zinc-850'
          }`}
          style={{ height: TRACK_HEIGHT, borderLeftWidth: 3, borderLeftColor: track.color }}
        >
          <span
            className="text-xs text-zinc-300 truncate flex-1 min-w-0"
            title={track.name}
          >
            {track.name}
          </span>

          <select
            value={track.instrumentId}
            onChange={e => dispatch(setInstrument({ trackId: track.id, instrumentId: e.target.value }))}
            className="text-xs bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 border border-zinc-700 focus:outline-none focus:border-violet-500"
            style={{ maxWidth: 72 }}
          >
            {Object.values(instruments).map(instr => (
              <option key={instr.id} value={instr.id}>{instr.name}</option>
            ))}
          </select>

          <button
            onClick={() => dispatch(openInstrument(track.instrumentId))}
            className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-violet-400 transition-colors"
            title="Edit instrument"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>tune</span>
          </button>

          <button
            onClick={() => dispatch(toggleMute(track.id))}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
              track.muted ? 'text-zinc-600' : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {track.muted ? 'volume_off' : 'volume_up'}
            </span>
          </button>

          <button
            onClick={() => dispatch(removeTrack(track.id))}
            className="flex items-center justify-center w-5 h-5 text-zinc-700 hover:text-red-400 transition-colors"
            title="Remove track"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      ))}
    </div>
  );
});
