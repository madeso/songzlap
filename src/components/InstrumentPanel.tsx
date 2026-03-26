import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index';
import { addInstrument, removeInstrument, openInstrument } from '../store/slice';
import { INSTRUMENTS } from '../constants';
import { uid } from '../utils';
import InstrumentEditor from './InstrumentEditor';
import WaveformIcon from './WaveformIcon';
import type { Instrument } from '../types';

interface Props {
  onClose: () => void;
}

export default function InstrumentPanel({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const instruments = useAppSelector(s => s.song.instruments);
  const tracks = useAppSelector(s => s.song.tracks);
  const openInstrumentId = useAppSelector(s => s.song.openInstrumentId);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const instrList = Object.values(instruments);
  const usedIds = new Set(tracks.map(t => t.instrumentId));

  function handleNew() {
    const instr: Instrument = {
      id: uid(), name: 'New Instrument', type: 'osc', osc: 'sine',
      attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2,
    };
    dispatch(addInstrument(instr));
    dispatch(openInstrument(instr.id));
    setDeleteError(null);
  }

  function handleSelect(id: string) {
    dispatch(openInstrument(openInstrumentId === id ? null : id));
    setDeleteError(null);
  }

  function handleDelete(id: string) {
    if (usedIds.has(id)) { setDeleteError(id); return; }
    if (openInstrumentId === id) dispatch(openInstrument(null));
    dispatch(removeInstrument(id));
    setDeleteError(null);
  }

  function handleAddPreset(preset: Instrument) {
    const instr: Instrument = { ...preset, id: uid() };
    dispatch(addInstrument(instr));
    dispatch(openInstrument(instr.id));
    setDeleteError(null);
    setPresetsOpen(false);
  }

  return (
    <div className="flex flex-col w-72 border-l border-zinc-800 bg-zinc-950 shrink-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 h-9 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>piano</span>
        <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider flex-1">Instruments</span>
        <button
          onClick={handleNew}
          className="text-xs px-2 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:text-violet-400 hover:border-violet-600 transition-colors"
          title="New instrument"
        >
          New
        </button>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
          title="Close panel"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Instrument list + presets (scrollable) */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {instrList.length === 0 && (
          <p className="text-xs text-zinc-600 px-3 py-3 italic">No instruments. Click New or add a preset.</p>
        )}

        {instrList.map(instr => {
          const selected = openInstrumentId === instr.id;
          return (
            <div key={instr.id}>
              <div
                className={`flex items-center gap-2 px-3 h-9 cursor-pointer select-none transition-colors ${
                  selected ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                }`}
                onClick={() => handleSelect(instr.id)}
              >
                <span
                  className={`material-symbols-outlined shrink-0 ${selected ? 'text-violet-400' : 'text-zinc-700'}`}
                  style={{ fontSize: 14 }}
                >
                  {selected ? 'chevron_right' : 'radio_button_unchecked'}
                </span>

                <span className="text-xs text-zinc-300 flex-1 truncate" title={instr.name}>{instr.name}</span>

                <span className="text-xs text-zinc-600 shrink-0 tabular-nums">
                  {instr.type === 'sample'
                    ? <span className="text-xs text-zinc-600">smp</span>
                    : <WaveformIcon type={instr.osc} size={20} className="text-zinc-600" />
                  }
                </span>

                <button
                  onClick={e => { e.stopPropagation(); handleDelete(instr.id); }}
                  className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 ml-1"
                  title="Delete instrument"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>

              {deleteError === instr.id && (
                <div className="flex items-center gap-1.5 px-3 pb-2 pt-0.5">
                  <span className="material-symbols-outlined text-amber-500 shrink-0" style={{ fontSize: 12 }}>warning</span>
                  <span className="text-xs text-amber-600 flex-1">
                    In use by {tracks.filter(t => t.instrumentId === instr.id).length} track(s)
                  </span>
                  <button onClick={() => setDeleteError(null)} className="text-zinc-600 hover:text-zinc-400">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add from preset */}
        <div className="border-t border-zinc-800 mt-1">
          <button
            onClick={() => setPresetsOpen(v => !v)}
            className="flex items-center gap-1.5 w-full px-3 h-8 text-xs text-zinc-500 hover:text-zinc-300 transition-colors select-none"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {presetsOpen ? 'expand_less' : 'expand_more'}
            </span>
            Add from preset
          </button>
          {presetsOpen && (
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {Object.values(INSTRUMENTS).map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleAddPreset(preset)}
                  className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-violet-400 hover:border-violet-600 transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Embedded instrument editor */}
      {openInstrumentId && instruments[openInstrumentId] && (
        <InstrumentEditor />
      )}
    </div>
  );
}
