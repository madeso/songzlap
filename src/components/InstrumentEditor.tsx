import { useMemo } from 'react';
import type { Dispatch } from 'react';
import type { Instrument, Action, SampleData } from '../types';

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

const W = 800; // SVG viewBox width (logical units)
const H = 48;
const MID = H / 2;

function Waveform({ sample }: { sample: SampleData }) {
  const { topPoints, botPoints } = useMemo(() => {
    const { pcm } = sample;
    if (pcm.length === 0) return { topPoints: `0,${MID} ${W},${MID}`, botPoints: '' };

    // Build a min/max envelope: for each display column, find the min and max PCM value
    const cols = W;
    const top: string[] = [];
    const bot: string[] = [];

    for (let col = 0; col < cols; col++) {
      const lo = Math.floor((col / cols) * pcm.length);
      const hi = Math.floor(((col + 1) / cols) * pcm.length);
      let mn = 127, mx = -128;
      for (let i = lo; i < hi; i++) {
        if (pcm[i] < mn) mn = pcm[i];
        if (pcm[i] > mx) mx = pcm[i];
      }
      if (mn > mx) { mn = 0; mx = 0; }
      // Normalize: pcm values are -128..127, map to y coords
      const yTop = MID - (mx / 128) * (MID - 2);
      const yBot = MID - (mn / 128) * (MID - 2);
      top.push(`${col},${yTop.toFixed(1)}`);
      bot.push(`${col},${yBot.toFixed(1)}`);
    }

    return {
      topPoints: top.join(' '),
      botPoints: bot.join(' '),
    };
  }, [sample]);

  const loopStartX = sample.loopLength > 0
    ? ((sample.loopStart / sample.pcm.length) * W).toFixed(1)
    : null;
  const loopEndX = sample.loopLength > 0
    ? (((sample.loopStart + sample.loopLength) / sample.pcm.length) * W).toFixed(1)
    : null;

  const sampleLenMs = Math.round((sample.pcm.length / sample.sampleRate) * 1000);

  return (
    <div className="px-3 pt-1 pb-0.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        className="block rounded overflow-hidden"
      >
        {/* Background */}
        <rect width={W} height={H} fill="#0c0c12" />

        {/* Centre line */}
        <line x1={0} y1={MID} x2={W} y2={MID} stroke="#222230" strokeWidth={1} />

        {/* Loop region shading */}
        {loopStartX !== null && loopEndX !== null && (
          <rect
            x={loopStartX} width={Number(loopEndX) - Number(loopStartX)} height={H}
            fill="#7c3aed" fillOpacity={0.18}
          />
        )}

        {/* Waveform: filled area between top and bottom envelopes */}
        <polyline points={topPoints} fill="none" stroke="#7c3aed" strokeWidth={0.8} opacity={0.9} />
        <polyline points={botPoints} fill="none" stroke="#7c3aed" strokeWidth={0.8} opacity={0.9} />

        {/* Loop markers */}
        {loopStartX !== null && (
          <line x1={loopStartX} y1={0} x2={loopStartX} y2={H}
            stroke="#10b981" strokeWidth={1} strokeDasharray="3,2" />
        )}
        {loopEndX !== null && (
          <line x1={loopEndX} y1={0} x2={loopEndX} y2={H}
            stroke="#10b981" strokeWidth={1} strokeDasharray="3,2" />
        )}
      </svg>
      <div className="flex justify-between mt-0.5 mb-1">
        <span className="text-xs text-zinc-600">{sample.pcm.length.toLocaleString()} frames · {sampleLenMs}ms · {(sample.sampleRate / 1000).toFixed(1)}kHz</span>
        {sample.loopLength > 0 && (
          <span className="text-xs text-emerald-700">loop</span>
        )}
      </div>
    </div>
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

      {/* Waveform display for sample instruments */}
      {instr.type === 'sample' && instr.sample && (
        <Waveform sample={instr.sample} />
      )}

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
