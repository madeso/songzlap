import type { Instrument } from './types';

export const BEATS_PER_BAR = 4;
export const SUBDIV = 4;             // 16th notes per beat
export const ARRANGEMENT_BARS = 32;
export const CLIP_DEFAULT_BEATS = 16; // 4 bars

export const TRACK_HEIGHT = 48;
export const BAR_WIDTH = 80;         // px per bar in arrangement
export const RULER_HEIGHT = 24;

// Piano roll
export const PR_NOTE_MIN = 36;       // C2
export const PR_NOTE_MAX = 84;       // C6 (exclusive → range is 36–83, 48 notes)
export const PR_NOTE_COUNT = PR_NOTE_MAX - PR_NOTE_MIN;
export const PR_NOTE_HEIGHT = 16;
export const PR_KEY_WIDTH = 56;
export const PR_CELL_WIDTH = 20;     // px per 16th note
export const VELOCITY_LANE_H = 32;  // px height of velocity lane in piano roll

export const TRACK_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];

export const INSTRUMENTS: Record<string, Instrument> = {
  lead:    { id: 'lead',    name: 'Synth Lead',  type: 'osc', osc: 'sawtooth',  attack: 0.01,  decay: 0.1,  sustain: 0.7, release: 0.2  },
  pad:     { id: 'pad',     name: 'Pad',         type: 'osc', osc: 'sine',      attack: 0.3,   decay: 0.2,  sustain: 0.8, release: 0.5  },
  bass:    { id: 'bass',    name: 'Bass',        type: 'osc', osc: 'square',    attack: 0.01,  decay: 0.05, sustain: 0.9, release: 0.05 },
  pluck:   { id: 'pluck',   name: 'Pluck',       type: 'osc', osc: 'triangle',  attack: 0.005, decay: 0.3,  sustain: 0.0, release: 0.1  },
  keys:    { id: 'keys',    name: 'Keys',        type: 'osc', osc: 'sine',      attack: 0.02,  decay: 0.3,  sustain: 0.5, release: 0.3  },
  organ:   { id: 'organ',   name: 'Organ',       type: 'osc', osc: 'sine',      attack: 0.01,  decay: 0.01, sustain: 1.0, release: 0.05 },
  strings: { id: 'strings', name: 'Strings',     type: 'osc', osc: 'sawtooth',  attack: 0.4,   decay: 0.3,  sustain: 0.7, release: 0.6  },
  brass:   { id: 'brass',   name: 'Brass',       type: 'osc', osc: 'sawtooth',  attack: 0.08,  decay: 0.2,  sustain: 0.6, release: 0.15 },
  bell:    { id: 'bell',    name: 'Bell',        type: 'osc', osc: 'sine',      attack: 0.005, decay: 0.8,  sustain: 0.0, release: 0.5  },
  sub:     { id: 'sub',     name: 'Sub Bass',    type: 'osc', osc: 'sine',      attack: 0.02,  decay: 0.1,  sustain: 0.8, release: 0.1  },
  lead2:   { id: 'lead2',   name: 'Hard Lead',   type: 'osc', osc: 'square',    attack: 0.01,  decay: 0.05, sustain: 0.8, release: 0.1  },
  stab:    { id: 'stab',    name: 'Stab',        type: 'osc', osc: 'sawtooth',  attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.05 },
};
