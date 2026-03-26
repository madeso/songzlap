import songReducer, {
  addTrack, removeTrack, setInstrument, toggleMute,
  addPlacement, removePlacement, openClip,
  addNote, removeNote, resizeNote,
  setBpm, setPlaying, updateInstrument, openInstrument,
  loadSong, setPlaybackMode, selectTrack, setLoop,
} from './slice';
import type { AppState, Instrument } from '../types';

// ─── fixture ──────────────────────────────────────────────────────────────────

const OSC_INSTR: Instrument = {
  id: 'lead', name: 'Lead', type: 'osc', osc: 'sawtooth',
  attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2,
};

const SAMPLE_INSTR: Instrument = {
  id: 'smp', name: 'Sample', type: 'sample', osc: 'sine',
  attack: 0, decay: 0, sustain: 1, release: 0.1,
  sample: { pcm: [0, 1, -1], sampleRate: 8363, loopStart: 0, loopLength: 0, finetune: 0, baseNote: 48 },
};

function baseState(overrides: Partial<AppState> = {}): AppState {
  const clipId = 'clip1';
  return {
    bpm: 120,
    playing: false,
    openClipId: null,
    openInstrumentId: null,
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 32,
    instruments: { lead: OSC_INSTR, smp: SAMPLE_INSTR },
    clips: {
      [clipId]: { id: clipId, notes: [], lengthBeats: 4 },
    },
    tracks: [
      { id: 'track1', name: 'Track 1', instrumentId: 'lead', placements: [], muted: false, color: '#8b5cf6' },
    ],
    ...overrides,
  };
}

function reduce(state: AppState, action: ReturnType<typeof addTrack> | ReturnType<typeof removeTrack> | ReturnType<typeof setInstrument> | ReturnType<typeof toggleMute> | ReturnType<typeof addPlacement> | ReturnType<typeof removePlacement> | ReturnType<typeof openClip> | ReturnType<typeof addNote> | ReturnType<typeof removeNote> | ReturnType<typeof resizeNote> | ReturnType<typeof setBpm> | ReturnType<typeof setPlaying> | ReturnType<typeof updateInstrument> | ReturnType<typeof openInstrument> | ReturnType<typeof loadSong> | ReturnType<typeof setPlaybackMode> | ReturnType<typeof selectTrack> | ReturnType<typeof setLoop>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return songReducer(state, action as any);
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('addTrack', () => {
  it('increments track count', () => {
    const s = reduce(baseState(), addTrack());
    expect(s.tracks).toHaveLength(2);
  });

  it('names new track based on count', () => {
    const s = reduce(baseState(), addTrack());
    expect(s.tracks[1].name).toBe('Track 2');
  });

  it('assigns first osc instrument', () => {
    const s = reduce(baseState(), addTrack());
    expect(s.instruments[s.tracks[1].instrumentId].type).toBe('osc');
  });

  it('new track starts unmuted with empty placements', () => {
    const s = reduce(baseState(), addTrack());
    expect(s.tracks[1].muted).toBe(false);
    expect(s.tracks[1].placements).toHaveLength(0);
  });
});

describe('removeTrack', () => {
  it('removes the target track', () => {
    const s = reduce(baseState(), removeTrack('track1'));
    expect(s.tracks).toHaveLength(0);
  });

  it('nulls openClipId when removed track owns the open clip', () => {
    const state = baseState({
      openClipId: 'clip1',
      tracks: [{
        id: 'track1', name: 'T', instrumentId: 'lead', muted: false, color: '#fff',
        placements: [{ id: 'pl1', clipId: 'clip1', startBeat: 0 }],
      }],
    });
    const s = reduce(state, removeTrack('track1'));
    expect(s.openClipId).toBeNull();
  });

  it('preserves openClipId when a different track is removed', () => {
    const state = baseState({
      openClipId: 'clip1',
      tracks: [
        { id: 'track1', name: 'T1', instrumentId: 'lead', muted: false, color: '#fff', placements: [{ id: 'pl1', clipId: 'clip1', startBeat: 0 }] },
        { id: 'track2', name: 'T2', instrumentId: 'lead', muted: false, color: '#fff', placements: [] },
      ],
    });
    const s = reduce(state, removeTrack('track2'));
    expect(s.openClipId).toBe('clip1');
  });

  it('nulls selectedTrackId when removing the selected track', () => {
    const state = baseState({ selectedTrackId: 'track1' });
    const s = reduce(state, removeTrack('track1'));
    expect(s.selectedTrackId).toBeNull();
  });

  it('preserves selectedTrackId when a different track is removed', () => {
    const state = baseState({
      selectedTrackId: 'track1',
      tracks: [
        { id: 'track1', name: 'T1', instrumentId: 'lead', muted: false, color: '#fff', placements: [] },
        { id: 'track2', name: 'T2', instrumentId: 'lead', muted: false, color: '#fff', placements: [] },
      ],
    });
    const s = reduce(state, removeTrack('track2'));
    expect(s.selectedTrackId).toBe('track1');
  });
});

describe('setInstrument', () => {
  it('updates instrumentId on the target track', () => {
    const s = reduce(baseState(), setInstrument({ trackId: 'track1', instrumentId: 'smp' }));
    expect(s.tracks[0].instrumentId).toBe('smp');
  });

  it('leaves other tracks unchanged', () => {
    const state = baseState({
      tracks: [
        { id: 'track1', name: 'T1', instrumentId: 'lead', muted: false, color: '#fff', placements: [] },
        { id: 'track2', name: 'T2', instrumentId: 'lead', muted: false, color: '#fff', placements: [] },
      ],
    });
    const s = reduce(state, setInstrument({ trackId: 'track1', instrumentId: 'smp' }));
    expect(s.tracks[1].instrumentId).toBe('lead');
  });
});

describe('toggleMute', () => {
  it('mutes an unmuted track', () => {
    const s = reduce(baseState(), toggleMute('track1'));
    expect(s.tracks[0].muted).toBe(true);
  });

  it('unmutes a muted track', () => {
    const state = baseState({ tracks: [{ id: 'track1', name: 'T', instrumentId: 'lead', muted: true, color: '#fff', placements: [] }] });
    const s = reduce(state, toggleMute('track1'));
    expect(s.tracks[0].muted).toBe(false);
  });
});

describe('addPlacement', () => {
  it('adds a placement to the target track', () => {
    const s = reduce(baseState(), addPlacement({ trackId: 'track1', startBeat: 0 }));
    expect(s.tracks[0].placements).toHaveLength(1);
  });

  it('creates a new clip atomically', () => {
    const s = reduce(baseState(), addPlacement({ trackId: 'track1', startBeat: 0 }));
    const pl = s.tracks[0].placements[0];
    expect(s.clips[pl.clipId]).toBeDefined();
    expect(s.clips[pl.clipId].notes).toHaveLength(0);
  });

  it('sets startBeat correctly', () => {
    const s = reduce(baseState(), addPlacement({ trackId: 'track1', startBeat: 8 }));
    expect(s.tracks[0].placements[0].startBeat).toBe(8);
  });
});

describe('removePlacement', () => {
  it('removes the placement from the track', () => {
    const state = baseState({
      tracks: [{ id: 'track1', name: 'T', instrumentId: 'lead', muted: false, color: '#fff', placements: [{ id: 'pl1', clipId: 'clip1', startBeat: 0 }] }],
    });
    const s = reduce(state, removePlacement({ trackId: 'track1', placementId: 'pl1' }));
    expect(s.tracks[0].placements).toHaveLength(0);
  });

  it('nulls openClipId when removed placement matches', () => {
    const state = baseState({
      openClipId: 'clip1',
      tracks: [{ id: 'track1', name: 'T', instrumentId: 'lead', muted: false, color: '#fff', placements: [{ id: 'pl1', clipId: 'clip1', startBeat: 0 }] }],
    });
    const s = reduce(state, removePlacement({ trackId: 'track1', placementId: 'pl1' }));
    expect(s.openClipId).toBeNull();
  });
});

describe('openClip', () => {
  it('sets openClipId', () => {
    const s = reduce(baseState(), openClip('clip1'));
    expect(s.openClipId).toBe('clip1');
  });

  it('accepts null to close', () => {
    const state = baseState({ openClipId: 'clip1' });
    const s = reduce(state, openClip(null));
    expect(s.openClipId).toBeNull();
  });
});

describe('addNote', () => {
  it('appends a note to the clip', () => {
    const s = reduce(baseState(), addNote({ clipId: 'clip1', note: { pitch: 60, beat: 0, duration: 1, velocity: 0.8 } }));
    expect(s.clips['clip1'].notes).toHaveLength(1);
  });

  it('assigned note has an id', () => {
    const s = reduce(baseState(), addNote({ clipId: 'clip1', note: { pitch: 60, beat: 0, duration: 1, velocity: 0.8 } }));
    expect(s.clips['clip1'].notes[0].id).toBeTruthy();
  });

  it('preserves note pitch, beat, duration, velocity', () => {
    const note = { pitch: 64, beat: 2, duration: 0.5, velocity: 0.7 };
    const s = reduce(baseState(), addNote({ clipId: 'clip1', note }));
    const n = s.clips['clip1'].notes[0];
    expect(n.pitch).toBe(64);
    expect(n.beat).toBe(2);
    expect(n.duration).toBe(0.5);
    expect(n.velocity).toBe(0.7);
  });

  it('is a no-op for unknown clipId', () => {
    const state = baseState();
    const s = reduce(state, addNote({ clipId: 'nonexistent', note: { pitch: 60, beat: 0, duration: 1, velocity: 1 } }));
    expect(s.clips).toEqual(state.clips);
  });
});

describe('removeNote', () => {
  it('removes the note by id', () => {
    const state = baseState({
      clips: { clip1: { id: 'clip1', lengthBeats: 4, notes: [{ id: 'n1', pitch: 60, beat: 0, duration: 1, velocity: 0.8 }] } },
    });
    const s = reduce(state, removeNote({ clipId: 'clip1', noteId: 'n1' }));
    expect(s.clips['clip1'].notes).toHaveLength(0);
  });
});

describe('resizeNote', () => {
  it('updates the note duration', () => {
    const state = baseState({
      clips: { clip1: { id: 'clip1', lengthBeats: 4, notes: [{ id: 'n1', pitch: 60, beat: 0, duration: 1, velocity: 0.8 }] } },
    });
    const s = reduce(state, resizeNote({ clipId: 'clip1', noteId: 'n1', duration: 2 }));
    expect(s.clips['clip1'].notes[0].duration).toBe(2);
  });

  it('does not affect other notes', () => {
    const state = baseState({
      clips: { clip1: { id: 'clip1', lengthBeats: 4, notes: [
        { id: 'n1', pitch: 60, beat: 0, duration: 1, velocity: 0.8 },
        { id: 'n2', pitch: 64, beat: 1, duration: 1, velocity: 0.8 },
      ] } },
    });
    const s = reduce(state, resizeNote({ clipId: 'clip1', noteId: 'n1', duration: 3 }));
    expect(s.clips['clip1'].notes[1].duration).toBe(1);
  });
});

describe('setBpm', () => {
  it('updates bpm', () => {
    const s = reduce(baseState(), setBpm(90));
    expect(s.bpm).toBe(90);
  });
});

describe('setPlaying', () => {
  it('sets playing to true', () => {
    const s = reduce(baseState(), setPlaying(true));
    expect(s.playing).toBe(true);
  });

  it('sets playing to false', () => {
    const state = baseState({ playing: true });
    const s = reduce(state, setPlaying(false));
    expect(s.playing).toBe(false);
  });
});

describe('updateInstrument', () => {
  it('replaces the instrument in the map', () => {
    const updated = { ...OSC_INSTR, name: 'Renamed' };
    const s = reduce(baseState(), updateInstrument(updated));
    expect(s.instruments['lead'].name).toBe('Renamed');
  });

  it('preserves other instruments', () => {
    const updated = { ...OSC_INSTR, name: 'X' };
    const s = reduce(baseState(), updateInstrument(updated));
    expect(s.instruments['smp']).toEqual(SAMPLE_INSTR);
  });
});

describe('openInstrument', () => {
  it('sets openInstrumentId', () => {
    const s = reduce(baseState(), openInstrument('lead'));
    expect(s.openInstrumentId).toBe('lead');
  });

  it('accepts null to close', () => {
    const state = baseState({ openInstrumentId: 'lead' });
    const s = reduce(state, openInstrument(null));
    expect(s.openInstrumentId).toBeNull();
  });
});

describe('loadSong', () => {
  it('replaces the entire state', () => {
    const newSong = { ...baseState(), bpm: 99 };
    const s = reduce(baseState({ bpm: 120 }), loadSong(newSong));
    expect(s.bpm).toBe(99);
  });

  it('always forces playing to false', () => {
    const newSong = { ...baseState(), playing: true } as unknown as Parameters<typeof loadSong>[0];
    const s = reduce(baseState(), loadSong(newSong));
    expect(s.playing).toBe(false);
  });
});

describe('setPlaybackMode', () => {
  it('sets mode to "track"', () => {
    const s = reduce(baseState(), setPlaybackMode('track'));
    expect(s.playbackMode).toBe('track');
  });

  it('sets mode back to "song"', () => {
    const state = baseState({ playbackMode: 'track' });
    const s = reduce(state, setPlaybackMode('song'));
    expect(s.playbackMode).toBe('song');
  });
});

describe('selectTrack', () => {
  it('sets selectedTrackId', () => {
    const s = reduce(baseState(), selectTrack('track1'));
    expect(s.selectedTrackId).toBe('track1');
  });

  it('accepts null to deselect', () => {
    const state = baseState({ selectedTrackId: 'track1' });
    const s = reduce(state, selectTrack(null));
    expect(s.selectedTrackId).toBeNull();
  });
});

describe('setLoop', () => {
  it('sets loopEnabled only', () => {
    const s = reduce(baseState(), setLoop({ enabled: true }));
    expect(s.loopEnabled).toBe(true);
    expect(s.loopStart).toBe(0);
    expect(s.loopEnd).toBe(32);
  });

  it('sets loopStart only', () => {
    const s = reduce(baseState(), setLoop({ start: 8 }));
    expect(s.loopStart).toBe(8);
    expect(s.loopEnabled).toBe(false); // unchanged
  });

  it('sets loopEnd only', () => {
    const s = reduce(baseState(), setLoop({ end: 16 }));
    expect(s.loopEnd).toBe(16);
  });

  it('sets all three at once', () => {
    const s = reduce(baseState(), setLoop({ enabled: true, start: 4, end: 12 }));
    expect(s.loopEnabled).toBe(true);
    expect(s.loopStart).toBe(4);
    expect(s.loopEnd).toBe(12);
  });
});
