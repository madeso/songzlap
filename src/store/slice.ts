import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AppState, Instrument, Note, Clip } from '../types';
import { uid } from '../utils';
import { TRACK_COLORS, CLIP_DEFAULT_BEATS, PR_NOTE_MIN, PR_NOTE_MAX } from '../constants';
import { makeInitialState } from '../store';

const songSlice = createSlice({
  name: 'song',
  initialState: makeInitialState as () => AppState,
  reducers: {
    addTrack(state) {
      const color = TRACK_COLORS[state.tracks.length % TRACK_COLORS.length];
      const instrumentId =
        Object.keys(state.instruments).find(k => state.instruments[k].type === 'osc') ??
        Object.keys(state.instruments)[0];
      state.tracks.push({ id: uid(), name: `Track ${state.tracks.length + 1}`, instrumentId, placements: [], muted: false, color });
    },
    removeTrack(state, action: PayloadAction<string>) {
      const track = state.tracks.find(t => t.id === action.payload);
      const opensRemoved = track?.placements.some(p => p.clipId === state.openClipId) ?? false;
      state.tracks = state.tracks.filter(t => t.id !== action.payload);
      if (opensRemoved) state.openClipId = null;
      if (state.selectedTrackId === action.payload) state.selectedTrackId = null;
    },
    setInstrument(state, action: PayloadAction<{ trackId: string; instrumentId: string }>) {
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (track) track.instrumentId = action.payload.instrumentId;
    },
    toggleMute(state, action: PayloadAction<string>) {
      const track = state.tracks.find(t => t.id === action.payload);
      if (track) track.muted = !track.muted;
    },
    addPlacement(state, action: PayloadAction<{ trackId: string; startBeat: number }>) {
      const clipId = uid();
      const newClip: Clip = { id: clipId, notes: [], lengthBeats: CLIP_DEFAULT_BEATS };
      state.clips[clipId] = newClip;
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (track) track.placements.push({ id: uid(), clipId, startBeat: action.payload.startBeat });
    },
    removePlacement(state, action: PayloadAction<{ trackId: string; placementId: string }>) {
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (!track) return;
      const pl = track.placements.find(p => p.id === action.payload.placementId);
      track.placements = track.placements.filter(p => p.id !== action.payload.placementId);
      if (pl?.clipId === state.openClipId) state.openClipId = null;
    },
    openClip(state, action: PayloadAction<string | null>) {
      state.openClipId = action.payload;
    },
    addNote(state, action: PayloadAction<{ clipId: string; note: Omit<Note, 'id'> }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      clip.notes.push({ ...action.payload.note, id: uid() });
    },
    removeNote(state, action: PayloadAction<{ clipId: string; noteId: string }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      clip.notes = clip.notes.filter(n => n.id !== action.payload.noteId);
    },
    resizeNote(state, action: PayloadAction<{ clipId: string; noteId: string; duration: number }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      const note = clip.notes.find(n => n.id === action.payload.noteId);
      if (note) note.duration = action.payload.duration;
    },
    transposeClip(state, action: PayloadAction<{ clipId: string; semitones: number }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      clip.notes = clip.notes.map(n => ({
        ...n,
        pitch: Math.max(PR_NOTE_MIN, Math.min(PR_NOTE_MAX - 1, n.pitch + action.payload.semitones)),
      }));
    },
    setBpm(state, action: PayloadAction<number>) {
      state.bpm = action.payload;
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.playing = action.payload;
    },
    updateInstrument(state, action: PayloadAction<Instrument>) {
      state.instruments[action.payload.id] = action.payload;
    },
    addInstrument(state, action: PayloadAction<Instrument>) {
      state.instruments[action.payload.id] = action.payload;
    },
    removeInstrument(state, action: PayloadAction<string>) {
      delete state.instruments[action.payload];
      if (state.openInstrumentId === action.payload) state.openInstrumentId = null;
    },
    openInstrument(state, action: PayloadAction<string | null>) {
      state.openInstrumentId = action.payload;
    },
    loadSong(_state, action: PayloadAction<Omit<AppState, 'playing'>>) {
      return { ...action.payload, playing: false };
    },
    setPlaybackMode(state, action: PayloadAction<'song' | 'track'>) {
      state.playbackMode = action.payload;
    },
    selectTrack(state, action: PayloadAction<string | null>) {
      state.selectedTrackId = action.payload;
    },
    setLoop(state, action: PayloadAction<{ enabled?: boolean; start?: number; end?: number }>) {
      if (action.payload.enabled !== undefined) state.loopEnabled = action.payload.enabled;
      if (action.payload.start !== undefined) state.loopStart = action.payload.start;
      if (action.payload.end !== undefined) state.loopEnd = action.payload.end;
    },
  },
});

export const {
  addTrack, removeTrack, setInstrument, toggleMute,
  addPlacement, removePlacement, openClip,
  addNote, removeNote, resizeNote, transposeClip,
  setBpm, setPlaying, updateInstrument, addInstrument, removeInstrument, openInstrument,
  loadSong, setPlaybackMode, selectTrack, setLoop,
} = songSlice.actions;

export default songSlice.reducer;
