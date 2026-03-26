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
  ['E',0.5],['E',0.5],['E',0.5],['D',0.5],['D',0.5],['E',0.5],['D',1],['G',2],
  ['-',1],
  ['E',0.5],['E',0.5],['E',1],   ['E',0.5],['E',0.5],['E',1],
  ['E',0.5],['G',0.5],['C',0.5],['D',0.5],['E',2],
  ['F',0.5],['F',0.5],['F',1],   ['F',0.5],['E',0.5],['E',0.5],['E',0.5],
  ['E',0.5],['E',0.5],['G',0.5],['G',0.5],['F',0.5],['D',0.5],['C',4],
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
  ['C',0.75],['C',0.25],['C5',1.5],['A',1],['F',1],['E',1],['D',2],
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

const ALOUETTE: Entry[] = [
  // C D E E  D C D E C G3
  ['C',1],['D',1],['E',1],['E',2],
  ['D',1],['C',1],['D',1],['E',1],['C',1],['G3',2],
  ['-',0.5],
  // C D E E  D C D E C
  ['C',1],['D',1],['E',1],['E',2],
  ['D',1],['C',1],['D',1],['E',1],['C',2],
  ['-',0.5],
  // C G3 C E G G G  G A G F E D C
  ['C',1],['G3',1],['C',1],['E',1],['G',1],['G',1],['G',2],
  ['G',1],['A',1],['G',1],['F',1],['E',1],['D',1],['C',2],
  ['-',0.5],
  // G G G  G3 G3 G3  (repeat x2)
  ['G',1],['G',1],['G',2],
  ['G3',1],['G3',1],['G3',2],
  ['G',1],['G',1],['G',2],
  ['G3',1],['G3',1],['G3',2],
  // G F E D
  ['G',1],['F',1],['E',1],['D',1],['C',4],
];

const INCY_WINCY: Entry[] = [
  // C C C D E E  E D C D E C
  ['C',1],['C',1],['C',1],['D',1],['E',1],['E',2],
  ['E',1],['D',1],['C',1],['D',1],['E',1],['C',2],
  ['-',0.5],
  // E E F G G  F E F G E
  ['E',1],['E',1],['F',1],['G',1],['G',2],
  ['F',1],['E',1],['F',1],['G',1],['E',2],
  ['-',0.5],
  // A A A G E  D E D C A3 G3 G3 G3
  ['A',1],['A',1],['A',1],['G',1],['E',2],
  ['D',1],['E',1],['D',1],['C',1],['A3',1],['G3',1],['G3',1],['G3',2],
  ['-',0.5],
  // C C C D E E  E D C D E C
  ['C',1],['C',1],['C',1],['D',1],['E',1],['E',2],
  ['E',1],['D',1],['C',1],['D',1],['E',1],['C',4],
];

const DECK_THE_HALLS: Entry[] = [
  // G F E D C D E C
  ['G',1],['F',1],['E',1],['D',1],['C',1],['D',1],['E',1],['C',2],
  // D E F D E
  ['D',0.5],['E',0.5],['F',1],['D',1],['E',2],
  // D C B3 C
  ['D',1],['C',1],['B3',1],['C',2],
  ['-',0.5],
  // G F E D C D E C
  ['G',1],['F',1],['E',1],['D',1],['C',1],['D',1],['E',1],['C',2],
  // D E F D E
  ['D',0.5],['E',0.5],['F',1],['D',1],['E',2],
  // D C B3 C
  ['D',1],['C',1],['B3',1],['C',2],
  ['-',0.5],
  // D E F D  E F G D  E F # G  A B C5  B A G
  ['D',1],['E',1],['F',1],['D',1],
  ['E',1],['F',1],['G',1],['D',1],
  ['E',1],['F#',1],['G',2],
  ['A',1],['B',1],['C5',2],
  ['B',1],['A',1],['G',2],
  ['-',0.5],
  // G F E D C D E C  A A A A G F E D C
  ['G',1],['F',1],['E',1],['D',1],['C',1],['D',1],['E',1],['C',2],
  ['A',0.5],['A',0.5],['A',0.5],['A',0.5],['G',1],['F',1],['E',1],['D',1],['C',4],
];

const HEART_AND_SOUL: Entry[] = [
  // C C E E  A3 A3 C C  D D F F  G3 G3 B3 B3
  ['C',1],['C',1],['E',1],['E',2],
  ['A3',1],['A3',1],['C',1],['C',2],
  ['D',1],['D',1],['F',1],['F',2],
  ['G3',1],['G3',1],['B3',1],['B3',2],
  ['-',0.5],
  // repeat
  ['C',1],['C',1],['E',1],['E',2],
  ['A3',1],['A3',1],['C',1],['C',2],
  ['D',1],['D',1],['F',1],['F',2],
  ['G3',1],['G3',1],['B3',1],['B3',1],['C',4],
];

const WHEELS_ON_BUS: Entry[] = [
  // C F F F F F  A C5 A F  G G G  E D C
  ['C',1],['F',1],['F',1],['F',1],['F',1],['F',2],
  ['A',1],['C5',1],['A',1],['F',2],
  ['G',1],['G',1],['G',2],
  ['E',1],['D',1],['C',2],
  ['-',0.5],
  // C F F F F F  A C A F  G C F
  ['C',1],['F',1],['F',1],['F',1],['F',1],['F',2],
  ['A',1],['C',1],['A',1],['F',2],
  ['G',1],['C',1],['F',4],
];

const THIS_OLD_MAN: Entry[] = [
  // G E G G E G  A G F E D E F
  ['G',1],['E',1],['G',1],['G',1],['E',1],['G',2],
  ['A',1],['G',1],['F',1],['E',1],['D',1],['E',1],['F',2],
  ['-',0.5],
  // E F G C C  C C C D E F G
  ['E',1],['F',1],['G',1],['C',1],['C',2],
  ['C',0.5],['C',0.5],['C',1],['D',1],['E',1],['F',1],['G',2],
  ['-',0.5],
  // G D D F E D C
  ['G',1],['D',1],['D',1],['F',1],['E',1],['D',1],['C',4],
];

const ROW_YOUR_BOAT: Entry[] = [
  // C C C D E
  ['C',1],['C',1],['C',0.75],['D',0.25],['E',2],
  // E D E F G
  ['E',0.75],['D',0.25],['E',0.75],['F',0.25],['G',2],
  ['-',0.5],
  // C5 C5 C5 G G G  E E E D D D
  ['C5',0.5],['C5',0.5],['C5',0.5],['G',0.5],['G',0.5],['G',0.5],
  ['E',0.5],['E',0.5],['E',0.5],['D',0.5],['D',0.5],['D',0.5],
  // G F E D C
  ['G',0.5],['F',0.5],['E',0.5],['D',0.5],['C',3],
];

const ANTS_GO_MARCHING: Entry[] = [
  // A3 D D D E F E F  D C A3 C
  ['A3',1],['D',1],['D',1],['D',1],['E',1],['F',1],['E',0.5],['F',0.5],
  ['D',1],['C',1],['A3',1],['C',2],
  ['-',0.5],
  // repeat with variation
  ['A3',1],['D',1],['D',1],['D',1],['E',1],['F',1],['E',0.5],['F',0.5],
  ['D',1],['C',1],['A3',1],['D',4],
];

// ─── Registry ────────────────────────────────────────────────────────────────

export interface DemoSong {
  name: string;
  make: () => Omit<AppState, 'playing'>;
}

export const DEMO_SONGS: DemoSong[] = [
  { name: 'Twinkle Twinkle Little Star', make: () => makeSong('Twinkle Twinkle',       'lead',    TWINKLE) },
  { name: 'Mary Had a Little Lamb',      make: () => makeSong('Mary Had a Little Lamb', 'keys',    MARY_LAMB) },
  { name: 'Ode to Joy',                  make: () => makeSong('Ode to Joy',             'strings', ODE_TO_JOY) },
  { name: 'Alouette',                    make: () => makeSong('Alouette',               'brass',   ALOUETTE) },
  { name: 'Incy Wincy Spider',           make: () => makeSong('Incy Wincy Spider',      'pluck',   INCY_WINCY) },
  { name: 'Deck the Halls',              make: () => makeSong('Deck the Halls',         'lead2',   DECK_THE_HALLS, 120) },
  { name: 'Frère Jacques',               make: () => makeSong('Frère Jacques',          'organ',   FRERE_JACQUES) },
  { name: 'Happy Birthday',              make: () => makeSong('Happy Birthday',         'bell',    HAPPY_BIRTHDAY, 100) },
  { name: 'Heart and Soul',              make: () => makeSong('Heart and Soul',         'keys',    HEART_AND_SOUL) },
  { name: 'The Wheels on the Bus',       make: () => makeSong('Wheels on the Bus',      'pad',     WHEELS_ON_BUS) },
  { name: 'Jingle Bells',               make: () => makeSong('Jingle Bells',           'pluck',   JINGLE_BELLS, 130) },
  { name: 'This Old Man',               make: () => makeSong('This Old Man',           'organ',   THIS_OLD_MAN) },
  { name: 'London Bridge',              make: () => makeSong('London Bridge',          'pad',     LONDON_BRIDGE) },
  { name: 'Row Your Boat',              make: () => makeSong('Row Your Boat',          'strings', ROW_YOUR_BOAT) },
  { name: 'The Ants Go Marching',       make: () => makeSong('Ants Go Marching',       'bass',    ANTS_GO_MARCHING, 120) },
];
