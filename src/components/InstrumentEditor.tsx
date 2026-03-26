import type { Dispatch } from 'react';
import type { Instrument, Action } from '../types';

interface Props {
  instrument: Instrument;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}

type OscType = OscillatorType;
const OSC_TYPES: { value: OscType; label: string }[] = [
  { value: 'sine',     label: 'Sine' },
  { value: 'square',   label: 'Sqr' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Tri' },
];

const fmtTime = (s: number) =>
  s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(2)}s`;

function update(instr: Instrument, patch: Partial<Instrument>, dispatch: Dispatch<Action>) {
  dispatch({ type: 'UPDATE_INSTRUMENT', instrument: { ...instr, ...patch } });
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}

function Knob({ label, value, min, max, step, display, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0 flex-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono text-zinc-400 tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-violet-500 cursor-pointer"
      />
    </label>
  );
}

export default function InstrumentEditor({ instrument: instr, dispatch, onClose }: Props) {
  return (
    <div className="border-t border-zinc-800 bg-zinc-950 shrink-0">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-3 bg-zinc-900 border-b border-zinc-800"
        style={{ height: 28 }}
      >
        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>
          piano
        </span>

        {/* Instrument name */}
        <input
          type="text"
          value={instr.name}
          onChange={e => update(instr, { name: e.target.value }, dispatch)}
          className="text-xs text-zinc-200 bg-transparent border-none outline-none w-28 font-medium"
          spellCheck={false}
        />

        {/* Osc type buttons (osc instruments only) */}
        {instr.type === 'osc' ? (
          <div className="flex gap-0.5">
            {OSC_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => update(instr, { osc: value }, dispatch)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                  instr.osc === value
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">Sample</span>
        )}

        <span className="ml-auto text-xs text-zinc-600">Instrument</span>

        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* ADSR row */}
      <div className="flex gap-4 px-4 py-2">
        <Knob
          label="A" value={instr.attack} min={0.001} max={2} step={0.001}
          display={fmtTime(instr.attack)}
          onChange={v => update(instr, { attack: v }, dispatch)}
        />
        <Knob
          label="D" value={instr.decay} min={0.001} max={2} step={0.001}
          display={fmtTime(instr.decay)}
          onChange={v => update(instr, { decay: v }, dispatch)}
        />
        <Knob
          label="S" value={instr.sustain} min={0} max={1} step={0.01}
          display={`${Math.round(instr.sustain * 100)}%`}
          onChange={v => update(instr, { sustain: v }, dispatch)}
        />
        <Knob
          label="R" value={instr.release} min={0.001} max={4} step={0.001}
          display={fmtTime(instr.release)}
          onChange={v => update(instr, { release: v }, dispatch)}
        />
      </div>
    </div>
  );
}
