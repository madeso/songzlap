import type { Dispatch } from 'react';
import type { Action } from '../types';
import { formatBeatTime } from '../utils';

interface Props {
  bpm: number;
  playing: boolean;
  currentBeat: number;
  dispatch: Dispatch<Action>;
  onPlayToggle: () => void;
}

export default function Transport({ bpm, playing, currentBeat, dispatch, onPlayToggle }: Props) {
  return (
    <header className="flex items-center gap-4 px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
      <span className="font-['Space_Grotesk'] font-semibold text-base text-violet-400 mr-2 tracking-tight">
        tunes
      </span>

      <button
        onClick={onPlayToggle}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 transition-colors"
        title={playing ? 'Stop (Space)' : 'Play (Space)'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {playing ? 'stop' : 'play_arrow'}
        </span>
      </button>

      <span className="font-mono text-sm text-zinc-400 w-12 tabular-nums">{formatBeatTime(currentBeat)}</span>

      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-500 uppercase tracking-wider">BPM</label>
        <input
          type="number"
          value={bpm}
          min={40}
          max={240}
          onChange={e => dispatch({ type: 'SET_BPM', bpm: Math.max(40, Math.min(240, Number(e.target.value))) })}
          className="w-16 bg-zinc-800 text-zinc-100 text-sm rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-violet-500"
        />
      </div>

      <span className="ml-auto text-xs text-zinc-600">
        Click grid to add clip · Click clip to edit · Right-click to delete
      </span>
    </header>
  );
}
