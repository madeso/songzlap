export type OscType = OscillatorType;

export interface Instrument {
  id: string;
  name: string;
  osc: OscType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
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
  openClipId: string | null;
  playing: boolean;
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
  | { type: 'SET_PLAYING'; playing: boolean };
