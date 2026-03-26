import type { AppState } from './types';
import { uid } from './utils';
import { INSTRUMENTS, TRACK_COLORS, ARRANGEMENT_BARS, BEATS_PER_BAR } from './constants';

const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

function tokenToMidi(token: string): number {
  const m = token.match(/^([A-G][#b]?)(\d)?$/);
  if (!m) return 60;
  const semi = NOTE_SEMITONES[m[1]] ?? 0;
  const oct = m[2] !== undefined ? parseInt(m[2]) : 4;
  return 12 * (oct + 1) + semi;
}

// [noteToken, durationInBeats] — use '-' for rests
type Entry = [string, number];

function buildNotes(seq: Entry[]) {
  const notes = [];
  let beat = 0;
  for (const [token, dur] of seq) {
    if (token !== '-') {
      notes.push({
        id: uid(),
        pitch: tokenToMidi(token),
        beat,
        duration: Math.max(0.1, dur * 0.85), // slight articulation gap
        velocity: 0.8,
      });
    }
    beat += dur;
  }
  return { notes, totalBeats: beat };
}

function makeSong(
  trackName: string,
  instrumentId: keyof typeof INSTRUMENTS,
  seq: Entry[],
  bpm = 110,
): Omit<AppState, 'playing'> {
  const { notes, totalBeats } = buildNotes(seq);
  const clipId = uid();
  const trackId = uid();
  const loopEnd = Math.min(
    Math.ceil(totalBeats / 4) * 4,
    ARRANGEMENT_BARS * BEATS_PER_BAR,
  );
  return {
    bpm,
    openClipId: null,
    openInstrumentId: null,
    instruments: { ...INSTRUMENTS },
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: true,
    loopStart: 0,
    loopEnd,
    clips: {
      [clipId]: { id: clipId, notes, lengthBeats: loopEnd },
    },
    tracks: [{
      id: trackId,
      name: trackName,
      instrumentId,
      placements: [{ id: uid(), clipId, startBeat: 0 }],
      muted: false,
      color: TRACK_COLORS[0],
    }],
  };
}

// ─── Song sequences ──────────────────────────────────────────────────────────

const TWINKLE: Entry[] = [
  ['C',1],['C',1],['G',1],['G',1],['A',1],['A',1],['G',2],
  ['F',1],['F',1],['E',1],['E',1],['D',1],['D',1],['C',2],
  ['G',1],['G',1],['F',1],['F',1],['E',1],['E',1],['D',2],
  ['G',1],['G',1],['F',1],['F',1],['E',1],['E',1],['D',2],
  ['C',1],['C',1],['G',1],['G',1],['A',1],['A',1],['G',2],
  ['F',1],['F',1],['E',1],['E',1],['D',1],['D',1],['C',4],
];

const MARY_LAMB: Entry[] = [
  ['E',1],['D',1],['C',1],['D',1],['E',1],['E',1],['E',2],
  ['D',1],['D',1],['D',2],
  ['E',1],['G',1],['G',2],
  ['E',1],['D',1],['C',1],['D',1],['E',1],['E',1],['E',2],
  ['D',1],['D',1],['E',1],['D',1],['C',4],
];

const ODE_TO_JOY: Entry[] = [
  ['E',1],['E',1],['F',1],['G',1],
  ['G',1],['F',1],['E',1],['D',1],
  ['C',1],['C',1],['D',1],['E',1],['E',1.5],['D',0.5],['C',2],
  ['-',1],
  ['E',1],['E',1],['F',1],['G',1],
  ['G',1],['F',1],['E',1],['D',1],
  ['C',1],['C',1],['D',1],['E',1],['D',1],['C',1],['C',4],
];

const JINGLE_BELLS: Entry[] = [
  ['E',0.5],['E',0.5],['E',1],   ['E',0.5],['E',0.5],['E',1],
  ['E',0.5],['G',0.5],['C',0.5],['D',0.5],['E',2],
  ['F',0.5],['F',0.5],['F',1],   ['F',0.5],['E',0.5],['E',0.5],['E',0.5],
  ['E',0.5],['D',0.5],['D',0.5],['E',0.5],['D',1],['G',2],
  ['-',1],
  ['E',0.5],['E',0.5],['E',1],   ['E',0.5],['E',0.5],['E',1],
  ['E',0.5],['G',0.5],['C',0.5],['D',0.5],['E',2],
  ['F',0.5],['F',0.5],['F',1],   ['F',0.5],['E',0.5],['E',0.5],['E',0.5],
  ['E',0.5],['G',0.5],['G',0.5],['F',0.5],['D',0.5],['C',4],
];

const LONDON_BRIDGE: Entry[] = [
  ['G',1],['A',1],['G',1],['F',1],['E',1],['F',1],['G',2],
  ['D',1],['E',1],['F',1],['E',1],['F',1],['G',2],
  ['G',1],['A',1],['G',1],['F',1],['E',1],['F',1],['G',2],
  ['D',1],['G',1],['E',1],['C',4],
];

const HAPPY_BIRTHDAY: Entry[] = [
  ['C',0.75],['C',0.25],['D',1],['C',1],['F',1],['E',2],
  ['-',0.5],
  ['C',0.75],['C',0.25],['D',1],['C',1],['G',1],['F',2],
  ['-',0.5],
  ['C',0.75],['C',0.25],['C',1.5],['A',1],['F',1],['E',1],['D',2],
  ['-',0.5],
  // Bb A F G F
  ['Bb',0.75],['Bb',0.25],['A',1],['F',1],['G',1],['F',4],
];

const FRERE_JACQUES: Entry[] = [
  ['C',1],['D',1],['E',1],['C',1],
  ['C',1],['D',1],['E',1],['C',1],
  ['E',1],['F',1],['G',2],
  ['E',1],['F',1],['G',2],
  ['G',0.5],['A',0.5],['G',0.5],['F',0.5],['E',1],['C',1],
  ['G',0.5],['A',0.5],['G',0.5],['F',0.5],['E',1],['C',1],
  ['C',1],['G3',1],['C',2],
  ['C',1],['G3',1],['C',4],
];

// ─── Registry ────────────────────────────────────────────────────────────────

export interface DemoSong {
  name: string;
  make: () => Omit<AppState, 'playing'>;
}

export const DEMO_SONGS: DemoSong[] = [
  { name: 'Twinkle Twinkle Little Star', make: () => makeSong('Twinkle Twinkle',      'lead',    TWINKLE) },
  { name: 'Mary Had a Little Lamb',      make: () => makeSong('Mary Had a Little Lamb','keys',    MARY_LAMB) },
  { name: 'Ode to Joy',                  make: () => makeSong('Ode to Joy',            'strings', ODE_TO_JOY) },
  { name: 'Jingle Bells',                make: () => makeSong('Jingle Bells',          'pluck',   JINGLE_BELLS, 130) },
  { name: 'London Bridge',               make: () => makeSong('London Bridge',         'pad',     LONDON_BRIDGE) },
  { name: 'Happy Birthday',              make: () => makeSong('Happy Birthday',        'bell',    HAPPY_BIRTHDAY, 100) },
  { name: 'Frère Jacques',               make: () => makeSong('Frère Jacques',         'organ',   FRERE_JACQUES) },
];
