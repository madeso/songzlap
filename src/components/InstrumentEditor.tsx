import { useMemo } from 'react';
import type { Instrument, SampleData } from '../types';
import { useAppDispatch, useAppSelector } from '../store/index';
import { updateInstrument, openInstrument } from '../store/slice';
import type { AppDispatch } from '../store/index';
import WaveformIcon from './WaveformIcon';

type OscType = OscillatorType;
const OSC_TYPES: { value: OscType }[] = [
  { value: 'sine' },
  { value: 'square' },
  { value: 'sawtooth' },
  { value: 'triangle' },
];

const fmtTime = (s: number) =>
  s < 1 ? `${Math.round(s * 1000)}ms` : `${s.toFixed(2)}s`;

function update(instr: Instrument, patch: Partial<Instrument>, dispatch: AppDispatch) {
  dispatch(updateInstrument({ ...instr, ...patch }));
}

// Convert polar angle (degrees from north, clockwise) to SVG x/y
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  size?: number;
}

const MIN_DEG = -135;
const MAX_DEG = 135;

function Knob({ label, value, min, max, step, display, onChange, size = 36 }: KnobProps) {
  const cx = size / 2;
  const cy = size / 2;
  const trackR = size * 0.42;
  const strokeW = size * 0.1;
  const indR1 = trackR - strokeW * 0.8;
  const indR2 = trackR + strokeW * 0.1;

  const t = max === min ? 0 : (value - min) / (max - min);
  const currentDeg = MIN_DEG + t * (MAX_DEG - MIN_DEG);

  const trackPath = arcPath(cx, cy, trackR, MIN_DEG, MAX_DEG);
  const valuePath = t > 0 ? arcPath(cx, cy, trackR, MIN_DEG, currentDeg) : null;
  const ind = { from: polar(cx, cy, indR1, currentDeg), to: polar(cx, cy, indR2, currentDeg) };

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;
    const range = max - min;
    const sensitivity = 150;

    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY;
      const sens = ev.shiftKey ? sensitivity * 10 : sensitivity;
      const raw = startValue + (dy / sens) * range;
      const clamped = Math.min(max, Math.max(min, raw));
      const stepped = Math.round(clamped / step) * step;
      onChange(Number(stepped.toFixed(10)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseDown={handleMouseDown}
        style={{ cursor: 'ns-resize' }}
        className="block"
      >
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#3f3f46" strokeWidth={strokeW} strokeLinecap="round" />
        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke="#7c3aed" strokeWidth={strokeW} strokeLinecap="round" />
        )}
        {/* Indicator */}
        <line
          x1={ind.from.x.toFixed(2)} y1={ind.from.y.toFixed(2)}
          x2={ind.to.x.toFixed(2)} y2={ind.to.y.toFixed(2)}
          stroke="#a78bfa" strokeWidth={strokeW * 0.8} strokeLinecap="round"
        />
      </svg>
      <span className="text-xs font-mono text-zinc-400 tabular-nums">{display}</span>
    </div>
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

export default function InstrumentEditor() {
  const dispatch = useAppDispatch()
  const instrId = useAppSelector(s => s.song.openInstrumentId)!
  const instr = useAppSelector(s => s.song.instruments[instrId])
  if (!instr) return null;
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
            {OSC_TYPES.map(({ value }) => (
              <button
                key={value}
                onClick={() => update(instr, { osc: value }, dispatch)}
                title={value.charAt(0).toUpperCase() + value.slice(1)}
                className={`flex items-center justify-center px-1.5 py-0.5 rounded transition-colors ${
                  instr.osc === value
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <WaveformIcon type={value} size={16} />
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">Sample</span>
        )}

        <span className="ml-auto text-xs text-zinc-600">Instrument</span>

        <button
          onClick={() => dispatch(openInstrument(null))}
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* Waveform display for sample instruments */}
      {instr.type === 'sample' && instr.sample && (
        <Waveform sample={instr.sample} />
      )}

      {/* ADSR knobs row */}
      <div className="flex justify-around px-4 py-3">
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
