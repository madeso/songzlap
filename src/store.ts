import type { AppState, Note } from './types';
import { uid } from './utils';
import { TRACK_COLORS, INSTRUMENTS, ARRANGEMENT_BARS, BEATS_PER_BAR } from './constants';

export function makeEmptyState(): Omit<AppState, 'playing'> {
  return {
    bpm: 120,
    openClipId: null,
    openInstrumentId: null,
    instruments: { ...INSTRUMENTS },
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: ARRANGEMENT_BARS * BEATS_PER_BAR,
    clips: {},
    tracks: [
      { id: uid(), name: 'Track 1', instrumentId: 'lead', placements: [], muted: false, color: TRACK_COLORS[0] },
    ],
  };
}

function buildDefaultState(): AppState {
  const clip1Id = uid();
  const clip2Id = uid();

  const melodyNotes: Omit<Note, 'id'>[] = [
    { pitch: 60, beat: 0,   duration: 0.5, velocity: 0.8 },
    { pitch: 64, beat: 1,   duration: 0.5, velocity: 0.7 },
    { pitch: 67, beat: 2,   duration: 0.5, velocity: 0.8 },
    { pitch: 71, beat: 3,   duration: 0.5, velocity: 0.7 },
    { pitch: 69, beat: 4,   duration: 0.5, velocity: 0.8 },
    { pitch: 67, beat: 5,   duration: 0.5, velocity: 0.7 },
    { pitch: 64, beat: 6,   duration: 0.5, velocity: 0.8 },
    { pitch: 60, beat: 7,   duration: 1.0, velocity: 0.7 },
  ];

  const bassNotes: Omit<Note, 'id'>[] = [
    { pitch: 36, beat: 0, duration: 1, velocity: 0.9 },
    { pitch: 36, beat: 2, duration: 1, velocity: 0.8 },
    { pitch: 43, beat: 4, duration: 1, velocity: 0.9 },
    { pitch: 36, beat: 6, duration: 1, velocity: 0.8 },
  ];

  return {
    bpm: 120,
    playing: false,
    openClipId: null,
    openInstrumentId: null,
    instruments: { ...INSTRUMENTS },
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: ARRANGEMENT_BARS * BEATS_PER_BAR,
    clips: {
      [clip1Id]: { id: clip1Id, notes: melodyNotes.map(n => ({ ...n, id: uid() })), lengthBeats: 8 },
      [clip2Id]: { id: clip2Id, notes: bassNotes.map(n => ({ ...n, id: uid() })), lengthBeats: 8 },
    },
    tracks: [
      { id: uid(), name: 'Melody', instrumentId: 'lead', placements: [{ id: uid(), clipId: clip1Id, startBeat: 0 }], muted: false, color: TRACK_COLORS[0] },
      { id: uid(), name: 'Bass',   instrumentId: 'bass', placements: [{ id: uid(), clipId: clip2Id, startBeat: 0 }], muted: false, color: TRACK_COLORS[1] },
    ],
  };
}

export function makeInitialState(): AppState {
  try {
    const saved = localStorage.getItem('tunes-song');
    if (saved) {
      const parsed = JSON.parse(saved) as AppState;
      if (parsed.tracks && parsed.clips && parsed.instruments) {
        return { ...buildDefaultState(), ...parsed, playing: false };
      }
    }
  } catch { /* ignore */ }
  return buildDefaultState();
}
