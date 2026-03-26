export type OscType = OscillatorType;

export interface SampleData {
  pcm: number[];       // 8-bit signed (-128..127)
  sampleRate: number;  // Hz (typically 8363 for MOD C-3)
  loopStart: number;   // frames
  loopLength: number;  // frames (0 = no loop)
  finetune: number;    // -8..7
  baseNote: number;    // MIDI note for unshifted playback (default 48 = C-3)
}

export interface Instrument {
  id: string;
  name: string;
  type: 'osc' | 'sample';
  osc: OscType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  sample?: SampleData;
}

export interface Note {
  id: string;
  pitch: number;     // MIDI note number (60 = C4)
  beat: number;      // start beat within clip (0-indexed)
  duration: number;  // in beats
  velocity: number;  // 0-1
}

export interface Clip {
  id: string;
  notes: Note[];
  lengthBeats: number;
}

export interface Placement {
  id: string;
  clipId: string;
  startBeat: number;
}

export interface Track {
  id: string;
  name: string;
  instrumentId: string;
  placements: Placement[];
  muted: boolean;
  color: string;
}

export interface AppState {
  bpm: number;
  tracks: Track[];
  clips: Record<string, Clip>;
  instruments: Record<string, Instrument>;
  openClipId: string | null;
  openInstrumentId: string | null;
  playing: boolean;
  playbackMode: 'song' | 'track';
  selectedTrackId: string | null;
  loopEnabled: boolean;
  loopStart: number;   // beats
  loopEnd: number;     // beats
}

export type Action =
  | { type: 'ADD_TRACK' }
  | { type: 'REMOVE_TRACK'; id: string }
  | { type: 'SET_INSTRUMENT'; trackId: string; instrumentId: string }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'ADD_PLACEMENT'; trackId: string; startBeat: number }
  | { type: 'REMOVE_PLACEMENT'; trackId: string; placementId: string }
  | { type: 'OPEN_CLIP'; clipId: string | null }
  | { type: 'ADD_NOTE'; clipId: string; note: Omit<Note, 'id'> }
  | { type: 'REMOVE_NOTE'; clipId: string; noteId: string }
  | { type: 'RESIZE_NOTE'; clipId: string; noteId: string; duration: number }
  | { type: 'SET_BPM'; bpm: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'UPDATE_INSTRUMENT'; instrument: Instrument }
  | { type: 'OPEN_INSTRUMENT'; id: string | null }
  | { type: 'LOAD_SONG'; state: Omit<AppState, 'playing'> }
  | { type: 'SET_PLAYBACK_MODE'; mode: 'song' | 'track' }
  | { type: 'SELECT_TRACK'; trackId: string | null }
  | { type: 'SET_LOOP'; enabled?: boolean; start?: number; end?: number };
