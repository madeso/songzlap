import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index';
import { setBpm, setPlaybackMode, setLoop } from '../store/slice';
import { formatBeatTime } from '../utils';
import { ARRANGEMENT_BARS, BEATS_PER_BAR } from '../constants';
import { DEMO_SONGS } from '../demosong';
import type { AppState } from '../types';

interface Props {
  currentBeat: number;
  onPlayToggle: () => void;
  onExportSong: () => void;
  onImportSong: () => void;
  onImportMod: () => void;
  onExportWav: () => void;
  onNewSong: () => void;
  instrumentsPanelOpen: boolean;
  onToggleInstruments: () => void;
  onLoadDemo: (state: Omit<AppState, 'playing'>) => void;
}

export default function Transport({
  currentBeat, onPlayToggle, onExportSong, onImportSong, onImportMod, onExportWav, onNewSong,
  instrumentsPanelOpen, onToggleInstruments, onLoadDemo,
}: Props) {
  const dispatch = useAppDispatch()
  const bpm = useAppSelector(s => s.song.bpm)
  const playing = useAppSelector(s => s.song.playing)
  const playbackMode = useAppSelector(s => s.song.playbackMode)
  const loopEnabled = useAppSelector(s => s.song.loopEnabled)
  const loopStart = useAppSelector(s => s.song.loopStart)
  const loopEnd = useAppSelector(s => s.song.loopEnd)
  const maxBeats = ARRANGEMENT_BARS * BEATS_PER_BAR;
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <header className="flex items-center gap-3 px-3 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none flex-wrap">
      <span className="font-['Space_Grotesk'] font-semibold text-base text-violet-400 tracking-tight">
        song zlap
      </span>

      {/* Play / Stop */}
      <button
        onClick={onPlayToggle}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors shrink-0"
        title={playing ? 'Stop (Space)' : 'Play (Space)'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {playing ? 'stop' : 'play_arrow'}
        </span>
      </button>

      {/* Playhead */}
      <span className="font-mono text-sm text-zinc-400 w-12 tabular-nums shrink-0">{formatBeatTime(currentBeat)}</span>

      {/* BPM */}
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-zinc-500 uppercase tracking-wider">BPM</label>
        <input
          type="number" value={bpm} min={40} max={240}
          onChange={e => dispatch(setBpm(Math.max(40, Math.min(240, Number(e.target.value)))))}
          className="w-14 bg-zinc-800 text-zinc-100 text-sm rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Song / Track toggle */}
      <div className="flex items-center bg-zinc-800 rounded overflow-hidden border border-zinc-700 shrink-0">
        {(['song', 'track'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => dispatch(setPlaybackMode(mode))}
            className={`text-xs px-2 py-1 capitalize transition-colors ${
              playbackMode === mode ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={mode === 'song' ? 'Play all tracks' : 'Play selected track only'}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Loop toggle */}
      <button
        onClick={() => dispatch(setLoop({ enabled: !loopEnabled }))}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
          loopEnabled
            ? 'bg-violet-600 border-violet-500 text-white'
            : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
        }`}
        title="Toggle loop"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>repeat</span>
        Loop
      </button>

      {/* Loop range (shown when loop is on) */}
      {loopEnabled && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-zinc-500">from</span>
          <input
            type="number" value={Math.round(loopStart)} min={0} max={loopEnd - 1} step={BEATS_PER_BAR}
            onChange={e => dispatch(setLoop({ start: Math.max(0, Math.min(loopEnd - BEATS_PER_BAR, Number(e.target.value))) }))}
            className="w-14 bg-zinc-800 text-zinc-100 text-xs rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-violet-500"
          />
          <span className="text-xs text-zinc-500">to</span>
          <input
            type="number" value={Math.round(loopEnd)} min={loopStart + 1} max={maxBeats} step={BEATS_PER_BAR}
            onChange={e => dispatch(setLoop({ end: Math.max(loopStart + BEATS_PER_BAR, Math.min(maxBeats, Number(e.target.value))) }))}
            className="w-14 bg-zinc-800 text-zinc-100 text-xs rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-violet-500"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        {/* New song */}
        <button
          onClick={onNewSong}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          title="New song"
        >
          New
        </button>
        {/* Demo songs */}
        <div className="relative">
          <button
            onClick={() => setDemoOpen(v => !v)}
            className={`flex items-center gap-0.5 text-xs px-2 py-1 rounded border transition-colors ${
              demoOpen
                ? 'bg-zinc-700 border-zinc-500 text-zinc-200'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
            }`}
            title="Load a demo song"
          >
            Demo
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              {demoOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {demoOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded shadow-xl min-w-48 py-1">
              {DEMO_SONGS.map(demo => (
                <button
                  key={demo.name}
                  onClick={() => { onLoadDemo(demo.make()); setDemoOpen(false); }}
                  className="block w-full text-left text-xs px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-violet-300 transition-colors"
                >
                  {demo.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Import MOD */}
        <button
          onClick={onImportMod}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          title="Import .mod file"
        >
          .mod
        </button>
        {/* Import .song */}
        <button
          onClick={onImportSong}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          title="Import .song file"
        >
          Import
        </button>
        {/* Export .song */}
        <button
          onClick={onExportSong}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          title="Export as .song"
        >
          Export
        </button>
        {/* Export WAV */}
        <button
          onClick={onExportWav}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
          title="Export as WAV"
        >
          WAV
        </button>
        {/* Instruments panel toggle */}
        <button
          onClick={onToggleInstruments}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
            instrumentsPanelOpen
              ? 'bg-violet-600 border-violet-500 text-white'
              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
          }`}
          title="Toggle instruments panel"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>piano</span>
          Instruments
        </button>
      </div>
    </header>
  );
}

