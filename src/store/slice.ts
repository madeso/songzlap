import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AppState, Instrument, Note, Clip, ChordConfig } from '../types';
import { uid } from '../utils';
import { generateChordNotes } from '../chords';
import { TRACK_COLORS, CLIP_DEFAULT_BEATS } from '../constants';
import { makeInitialState } from '../store';

// Pure helper used by setChordConfig and regenerateChordTrack reducers
function regenerateChordClips(state: AppState, chordTrackId: string) {
  const chordTrack = state.tracks.find(t => t.id === chordTrackId);
  if (!chordTrack?.chordConfig) return;
  const { chordConfig } = chordTrack;
  const sourceTrack = state.tracks.find(t => t.id === chordConfig.sourceTrackId);
  if (!sourceTrack) return;

  // Update existing placements in-place to preserve clip IDs (keeps openClipId valid)
  const existingPlacements = chordTrack.placements;
  const newPlacements = sourceTrack.placements.map((pl, i) => {
    const sourceClip = state.clips[pl.clipId];
    const chordNotes = sourceClip
      ? generateChordNotes(sourceClip.notes, sourceClip.lengthBeats, chordConfig)
      : [];
    const lengthBeats = sourceClip?.lengthBeats ?? 16;

    const existing = existingPlacements[i];
    if (existing) {
      // Reuse the same clip ID — update in place so openClipId remains valid
      state.clips[existing.clipId] = { id: existing.clipId, notes: chordNotes, lengthBeats };
      return { ...existing, startBeat: pl.startBeat };
    } else {
      // New placement needed (source gained more placements than chord track had)
      const clipId = uid();
      state.clips[clipId] = { id: clipId, notes: chordNotes, lengthBeats };
      return { id: uid(), clipId, startBeat: pl.startBeat };
    }
  });

  // Remove orphaned placements if source lost placements
  for (let i = newPlacements.length; i < existingPlacements.length; i++) {
    const orphanId = existingPlacements[i].clipId;
    if (orphanId === state.openClipId) state.openClipId = null;
    delete state.clips[orphanId];
  }

  chordTrack.placements = newPlacements;
}

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
    updateNotes(state, action: PayloadAction<{
      clipId: string;
      updates: Array<{ noteId: string; beat?: number; pitch?: number; duration?: number }>;
    }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      for (const upd of action.payload.updates) {
        const note = clip.notes.find(n => n.id === upd.noteId);
        if (!note) continue;
        if (upd.beat !== undefined) note.beat = upd.beat;
        if (upd.pitch !== undefined) note.pitch = upd.pitch;
        if (upd.duration !== undefined) note.duration = upd.duration;
      }
    },
    transposeClip(state, action: PayloadAction<{ clipId: string; semitones: number }>) {
      const clip = state.clips[action.payload.clipId];
      if (!clip) return;
      clip.notes = clip.notes.map(n => ({ ...n, pitch: n.pitch + action.payload.semitones }));
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
    addChordTrack(state, action: PayloadAction<string>) {
      const sourceTrack = state.tracks.find(t => t.id === action.payload);
      if (!sourceTrack) return;

      const color = TRACK_COLORS[state.tracks.length % TRACK_COLORS.length];
      const instrumentId =
        Object.keys(state.instruments).find(k => state.instruments[k].type === 'osc') ??
        Object.keys(state.instruments)[0];

      const config: ChordConfig = {
        sourceTrackId: action.payload,
        noteDuration: 1,
        octave: 0,
        style: 'block',
      };

      const newTrack = {
        id: uid(),
        name: `${sourceTrack.name} Chords`,
        instrumentId,
        placements: [] as typeof sourceTrack.placements,
        muted: false,
        color,
        chordConfig: config,
      };

      for (const pl of sourceTrack.placements) {
        const sourceClip = state.clips[pl.clipId];
        if (!sourceClip) continue;
        const chordNotes = generateChordNotes(sourceClip.notes, sourceClip.lengthBeats, config);
        const clipId = uid();
        state.clips[clipId] = { id: clipId, notes: chordNotes, lengthBeats: sourceClip.lengthBeats };
        newTrack.placements.push({ id: uid(), clipId, startBeat: pl.startBeat });
      }

      const sourceIndex = state.tracks.findIndex(t => t.id === action.payload);
      state.tracks.splice(sourceIndex + 1, 0, newTrack);
    },
    setChordConfig(state, action: PayloadAction<{ trackId: string; config: ChordConfig }>) {
      const track = state.tracks.find(t => t.id === action.payload.trackId);
      if (!track) return;
      track.chordConfig = action.payload.config;
      // Regenerate immediately when config changes
      regenerateChordClips(state, track.id);
    },
    regenerateChordTrack(state, action: PayloadAction<string>) {
      regenerateChordClips(state, action.payload);
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
  addNote, removeNote, resizeNote, updateNotes, transposeClip,
  setBpm, setPlaying, updateInstrument, addInstrument, removeInstrument, openInstrument,
  loadSong, setPlaybackMode, selectTrack, setLoop, addChordTrack, setChordConfig, regenerateChordTrack,
} = songSlice.actions;

export default songSlice.reducer;
