import type { AppState, Action, Note } from './types';
import { uid } from './utils';
import { TRACK_COLORS, INSTRUMENTS, CLIP_DEFAULT_BEATS } from './constants';

export function makeInitialState(): AppState {
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TRACK': {
      const color = TRACK_COLORS[state.tracks.length % TRACK_COLORS.length];
      return {
        ...state,
        tracks: [...state.tracks, {
          id: uid(),
          name: `Track ${state.tracks.length + 1}`,
          instrumentId: Object.keys(INSTRUMENTS)[0],
          placements: [],
          muted: false,
          color,
        }],
      };
    }
    case 'REMOVE_TRACK': {
      const track = state.tracks.find(t => t.id === action.id);
      const opensRemoved = track?.placements.some(p => p.clipId === state.openClipId) ?? false;
      return {
        ...state,
        tracks: state.tracks.filter(t => t.id !== action.id),
        openClipId: opensRemoved ? null : state.openClipId,
      };
    }
    case 'SET_INSTRUMENT':
      return { ...state, tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, instrumentId: action.instrumentId } : t) };
    case 'TOGGLE_MUTE':
      return { ...state, tracks: state.tracks.map(t => t.id === action.trackId ? { ...t, muted: !t.muted } : t) };
    case 'ADD_PLACEMENT': {
      const clipId = uid();
      const newClip = { id: clipId, notes: [], lengthBeats: CLIP_DEFAULT_BEATS };
      return {
        ...state,
        clips: { ...state.clips, [clipId]: newClip },
        tracks: state.tracks.map(t =>
          t.id === action.trackId
            ? { ...t, placements: [...t.placements, { id: uid(), clipId, startBeat: action.startBeat }] }
            : t
        ),
      };
    }
    case 'REMOVE_PLACEMENT': {
      const track = state.tracks.find(t => t.id === action.trackId);
      const pl = track?.placements.find(p => p.id === action.placementId);
      return {
        ...state,
        tracks: state.tracks.map(t =>
          t.id === action.trackId
            ? { ...t, placements: t.placements.filter(p => p.id !== action.placementId) }
            : t
        ),
        openClipId: pl?.clipId === state.openClipId ? null : state.openClipId,
      };
    }
    case 'OPEN_CLIP':
      return { ...state, openClipId: action.clipId };
    case 'ADD_NOTE': {
      const clip = state.clips[action.clipId];
      if (!clip) return state;
      return { ...state, clips: { ...state.clips, [action.clipId]: { ...clip, notes: [...clip.notes, { ...action.note, id: uid() }] } } };
    }
    case 'REMOVE_NOTE': {
      const clip = state.clips[action.clipId];
      if (!clip) return state;
      return { ...state, clips: { ...state.clips, [action.clipId]: { ...clip, notes: clip.notes.filter(n => n.id !== action.noteId) } } };
    }
    case 'SET_BPM':
      return { ...state, bpm: action.bpm };
    case 'SET_PLAYING':
      return { ...state, playing: action.playing };
    default:
      return state;
  }
}
