import type { Note, ChordConfig } from './types';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// Key detection
// ---------------------------------------------------------------------------

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

const MAJOR_TRIADS: [number, number, number][] = [
  [0, 4, 7], [2, 5, 9], [4, 7, 11], [5, 9, 0],
  [7, 11, 2], [9, 0, 4], [11, 2, 5],
];
const MINOR_TRIADS: [number, number, number][] = [
  [0, 3, 7], [2, 5, 8], [3, 7, 10], [5, 8, 0],
  [7, 10, 2], [8, 0, 3], [10, 2, 5],
];

interface KeyInfo {
  root: number;
  isMinor: boolean;
  triads: [number, number, number][];
}

function detectKey(notes: Note[]): KeyInfo {
  const weights = new Array<number>(12).fill(0);
  for (const n of notes) weights[((n.pitch % 12) + 12) % 12] += n.duration;

  let bestScore = -1, bestRoot = 0, bestMinor = false;
  for (let root = 0; root < 12; root++) {
    for (const [isMinor, intervals] of [[false, MAJOR_INTERVALS] as const, [true, MINOR_INTERVALS] as const]) {
      const diatonic = new Set(intervals.map(i => (root + i) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) score += diatonic.has(pc) ? weights[pc] : -weights[pc] * 0.5;
      if (score > bestScore) { bestScore = score; bestRoot = root; bestMinor = isMinor; }
    }
  }
  return {
    root: bestRoot, isMinor: bestMinor,
    triads: (bestMinor ? MINOR_TRIADS : MAJOR_TRIADS).map(([a, b, c]) => [
      (bestRoot + a) % 12, (bestRoot + b) % 12, (bestRoot + c) % 12,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

interface Segment { startBeat: number; endBeat: number; notes: Note[]; }

function segmentNotes(notes: Note[], clipLengthBeats: number): Segment[] {
  const bars = Math.ceil(clipLengthBeats / 4);
  const segments: Segment[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * 4, barEnd = Math.min(barStart + 4, clipLengthBeats);
    const barNotes = notes.filter(n => n.beat >= barStart && n.beat < barEnd);
    const firstHalf = barNotes.filter(n => n.beat < barStart + 2);
    const secondHalf = barNotes.filter(n => n.beat >= barStart + 2);
    const dominantPc = (ns: Note[]) => {
      const w = new Array<number>(12).fill(0);
      for (const n of ns) w[((n.pitch % 12) + 12) % 12] += n.duration;
      return w.indexOf(Math.max(...w));
    };
    const leaps = firstHalf.length > 0 && secondHalf.length > 0 &&
      Math.abs(dominantPc(firstHalf) - dominantPc(secondHalf)) >= 5;
    if (leaps) {
      segments.push({ startBeat: barStart,     endBeat: barStart + 2, notes: firstHalf });
      segments.push({ startBeat: barStart + 2, endBeat: barEnd,       notes: secondHalf });
    } else {
      segments.push({ startBeat: barStart, endBeat: barEnd, notes: barNotes });
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Chord selection
// ---------------------------------------------------------------------------

function pickChord(segment: Segment, key: KeyInfo): [number, number, number] {
  const weights = new Array<number>(12).fill(0);
  for (const n of segment.notes) weights[((n.pitch % 12) + 12) % 12] += n.duration;
  const preference = [0.3, 0, 0, 0.2, 0.2, 0, 0];
  let bestScore = -Infinity, bestTriad = key.triads[0];
  for (let ti = 0; ti < key.triads.length; ti++) {
    let score = preference[ti] ?? 0;
    for (const pc of key.triads[ti]) score += weights[pc];
    if (score > bestScore) { bestScore = score; bestTriad = key.triads[ti]; }
  }
  return bestTriad;
}

// ---------------------------------------------------------------------------
// Voicing helpers
// ---------------------------------------------------------------------------

function voiceTriad(pc1: number, pc2: number, pc3: number, baseOctave: number): [number, number, number] {
  const root = 12 * (baseOctave + 1) + pc1;
  const third = root + ((pc2 - pc1 + 12) % 12 || 12);
  const fifth = root + ((pc3 - pc1 + 12) % 12 || 12);
  const sorted = [third, fifth].sort((a, b) => a - b) as [number, number];
  return [root, ...sorted] as [number, number, number];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ChordConfig = {
  sourceTrackId: '',
  noteDuration: 1,
  octave: 0,
  style: 'block',
};

export function generateChordNotes(
  melodyNotes: Note[],
  clipLengthBeats: number,
  config: ChordConfig = DEFAULT_CONFIG,
): Note[] {
  if (melodyNotes.length === 0) return [];

  const key = detectKey(melodyNotes);
  const segments = segmentNotes(melodyNotes, clipLengthBeats);
  const baseOctave = 3 + config.octave;
  const dur = config.noteDuration;
  const result: Note[] = [];

  for (const seg of segments) {
    if (seg.startBeat >= clipLengthBeats) continue;
    const [pc1, pc2, pc3] = pickChord(seg, key);
    const [root, third, fifth] = voiceTriad(pc1, pc2, pc3, baseOctave);

    if (config.style === 'bass-only') {
      for (let beat = seg.startBeat; beat < seg.endBeat - 0.001; beat += dur) {
        const d = Math.min(dur, seg.endBeat - beat);
        result.push({ id: uid(), pitch: root, beat, duration: d, velocity: 0.65 });
      }
    } else if (config.style === 'block') {
      for (let beat = seg.startBeat; beat < seg.endBeat - 0.001; beat += dur) {
        const d = Math.min(dur, seg.endBeat - beat);
        for (const pitch of [root, third, fifth]) {
          result.push({ id: uid(), pitch, beat, duration: d, velocity: 0.65 });
        }
      }
    } else if (config.style === 'strum') {
      for (let beat = seg.startBeat; beat < seg.endBeat - 0.001; beat += dur) {
        const d = Math.min(dur, seg.endBeat - beat);
        result.push({ id: uid(), pitch: root,  beat: beat,        duration: d,        velocity: 0.70 });
        result.push({ id: uid(), pitch: third, beat: beat + 0.05, duration: d - 0.05, velocity: 0.60 });
        result.push({ id: uid(), pitch: fifth, beat: beat + 0.10, duration: d - 0.10, velocity: 0.55 });
      }
    } else {
      // arpeggio-up or arpeggio-down
      const pitches = config.style === 'arpeggio-down'
        ? [root, fifth, third]
        : [root, third, fifth];
      let idx = 0;
      for (let beat = seg.startBeat; beat < seg.endBeat - 0.001; beat += dur) {
        const d = Math.min(dur, seg.endBeat - beat);
        result.push({ id: uid(), pitch: pitches[idx % 3], beat, duration: d, velocity: 0.65 });
        idx++;
      }
    }
  }

  return result;
}

export type { ChordConfig };
