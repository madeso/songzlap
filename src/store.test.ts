import { makeEmptyState, makeInitialState } from './store';

describe('makeEmptyState', () => {
  it('returns exactly one track', () => {
    const state = makeEmptyState();
    expect(state.tracks).toHaveLength(1);
  });

  it('has an empty clips map', () => {
    const state = makeEmptyState();
    expect(Object.keys(state.clips)).toHaveLength(0);
  });

  it('has instruments present', () => {
    const state = makeEmptyState();
    expect(Object.keys(state.instruments).length).toBeGreaterThan(0);
  });

  it('defaults to 120 bpm', () => {
    expect(makeEmptyState().bpm).toBe(120);
  });

  it('openClipId and openInstrumentId are null', () => {
    const state = makeEmptyState();
    expect(state.openClipId).toBeNull();
    expect(state.openInstrumentId).toBeNull();
  });

  it('playbackMode is "song"', () => {
    expect(makeEmptyState().playbackMode).toBe('song');
  });

  it('loopEnabled is false', () => {
    expect(makeEmptyState().loopEnabled).toBe(false);
  });
});

describe('makeInitialState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a demo song with 2 tracks when localStorage is empty', () => {
    const state = makeInitialState();
    expect(state.tracks).toHaveLength(2);
    expect(Object.keys(state.clips).length).toBeGreaterThan(0);
  });

  it('always returns playing: false', () => {
    expect(makeInitialState().playing).toBe(false);
  });

  it('restores state from localStorage when valid JSON is present', () => {
    const saved = { ...makeEmptyState(), bpm: 95 };
    localStorage.setItem('tunes-song', JSON.stringify(saved));
    const state = makeInitialState();
    expect(state.bpm).toBe(95);
    expect(state.playing).toBe(false);
  });

  it('falls back to demo song when localStorage contains invalid JSON', () => {
    localStorage.setItem('tunes-song', '{invalid json}');
    const state = makeInitialState();
    expect(state.tracks).toHaveLength(2); // demo song
  });

  it('falls back to demo song when localStorage JSON is missing required fields', () => {
    localStorage.setItem('tunes-song', JSON.stringify({ bpm: 140 }));
    const state = makeInitialState();
    expect(state.tracks).toHaveLength(2); // demo song
  });
});
