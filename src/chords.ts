import type { Note } from './types';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// Key detection
// ---------------------------------------------------------------------------

// Intervals in a major scale (relative to root)
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
// Intervals in a natural minor scale
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

// Diatonic triads in a major key (by scale degree, root-relative semitones)
// [root, third, fifth] offsets from the key root
const MAJOR_TRIADS: [number, number, number][] = [
  [0, 4, 7],  // I   major
  [2, 5, 9],  // ii  minor
  [4, 7, 11], // iii minor
  [5, 9, 0],  // IV  major
  [7, 11, 2], // V   major
  [9, 0, 4],  // vi  minor
  [11, 2, 5], // vii diminished (use as minor for simplicity)
];

// Diatonic triads in a minor key
const MINOR_TRIADS: [number, number, number][] = [
  [0, 3, 7],  // i   minor
  [2, 5, 8],  // ii° (minor)
  [3, 7, 10], // III major
  [5, 8, 0],  // iv  minor
  [7, 10, 2], // v   minor  (natural minor)
  [8, 0, 3],  // VI  major
  [10, 2, 5], // VII major
];

interface KeyInfo {
  root: number;        // 0–11
  isMinor: boolean;
  triads: [number, number, number][];
}

function detectKey(notes: Note[]): KeyInfo {
  // Weight each pitch class by total duration
  const weights = new Array<number>(12).fill(0);
  for (const n of notes) weights[((n.pitch % 12) + 12) % 12] += n.duration;

  let bestScore = -1;
  let bestRoot = 0;
  let bestMinor = false;

  for (let root = 0; root < 12; root++) {
    for (const [isMinor, intervals] of [
      [false, MAJOR_INTERVALS] as const,
      [true,  MINOR_INTERVALS] as const,
    ]) {
      const diatonic = new Set(intervals.map(i => (root + i) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        if (diatonic.has(pc)) score += weights[pc];
        else score -= weights[pc] * 0.5; // penalise chromatic notes
      }
      if (score > bestScore) { bestScore = score; bestRoot = root; bestMinor = isMinor; }
    }
  }

  return {
    root: bestRoot,
    isMinor: bestMinor,
    triads: (bestMinor ? MINOR_TRIADS : MAJOR_TRIADS).map(([a, b, c]) => [
      (bestRoot + a) % 12,
      (bestRoot + b) % 12,
      (bestRoot + c) % 12,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Segmentation — 1-bar base; split to half-bar when melody leaps ≥ a 4th
// ---------------------------------------------------------------------------

interface Segment {
  startBeat: number;
  endBeat: number;
  notes: Note[];
}

function segmentNotes(notes: Note[], clipLengthBeats: number): Segment[] {
  const bars = Math.ceil(clipLengthBeats / 4);
  const segments: Segment[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * 4;
    const barEnd = Math.min(barStart + 4, clipLengthBeats);
    const barNotes = notes.filter(n => n.beat >= barStart && n.beat < barEnd);

    // Detect if there's a leap of ≥ 5 semitones between first and second half
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
// Chord selection — best-fitting diatonic triad for each segment
// ---------------------------------------------------------------------------

function pickChord(segment: Segment, key: KeyInfo): [number, number, number] {
  const weights = new Array<number>(12).fill(0);
  for (const n of segment.notes) weights[((n.pitch % 12) + 12) % 12] += n.duration;

  // Prefer I / IV / V (indices 0, 3, 4) as tiebreaker
  const preferenceBonus = [0.3, 0, 0, 0.2, 0.2, 0, 0];

  let bestScore = -Infinity;
  let bestTriad = key.triads[0];

  for (let ti = 0; ti < key.triads.length; ti++) {
    const triad = key.triads[ti];
    let score = preferenceBonus[ti] ?? 0;
    for (const pc of triad) score += weights[pc];
    if (score > bestScore) { bestScore = score; bestTriad = triad; }
  }

  return bestTriad;
}

// ---------------------------------------------------------------------------
// Public API — generate chord notes for one clip
// ---------------------------------------------------------------------------

export function generateChordNotes(melodyNotes: Note[], clipLengthBeats: number): Note[] {
  if (melodyNotes.length === 0) return [];

  const key = detectKey(melodyNotes);
  const segments = segmentNotes(melodyNotes, clipLengthBeats);
  const chordNotes: Note[] = [];

  for (const seg of segments) {
    // Skip silent segments
    if (seg.startBeat >= clipLengthBeats) continue;

    const [pc1, pc2, pc3] = pickChord(seg, key);
    const duration = seg.endBeat - seg.startBeat;

    // Voice chord in octave 3 (MIDI 48 = C3), ensuring root < 3rd < 5th
    const rootPitch = 36 + pc1; // C3 = 48, but root in lower octave 3 range
    const third  = rootPitch + ((pc2 - pc1 + 12) % 12 || 12);
    const fifth  = rootPitch + ((pc3 - pc1 + 12) % 12 || 12);
    // Ensure third < fifth (diminished 5th edge case)
    const sortedUpper = [third, fifth].sort((a, b) => a - b);

    for (const pitch of [rootPitch, ...sortedUpper]) {
      chordNotes.push({ id: uid(), pitch, beat: seg.startBeat, duration, velocity: 0.65 });
    }
  }

  return chordNotes;
}
