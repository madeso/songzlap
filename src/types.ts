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

