import { uid, midiToFreq, midiToName, isBlackKey, beatsToSeconds, formatBeatTime } from './utils';

describe('uid', () => {
  it('returns a 7-character alphanumeric string', () => {
    const id = uid();
    expect(id).toHaveLength(7);
    expect(id).toMatch(/^[0-9a-z]+$/);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, uid));
    expect(ids.size).toBe(100);
  });
});

describe('midiToFreq', () => {
  it('A4 (69) = 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
  });

  it('A3 (57) = 220 Hz', () => {
    expect(midiToFreq(57)).toBeCloseTo(220, 5);
  });

  it('A5 (81) = 880 Hz', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 5);
  });

  it('C4 (60) ≈ 261.63 Hz', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });
});

describe('midiToName', () => {
  it('60 = C4', () => expect(midiToName(60)).toBe('C4'));
  it('61 = C#4', () => expect(midiToName(61)).toBe('C#4'));
  it('59 = B3', () => expect(midiToName(59)).toBe('B3'));
  it('69 = A4', () => expect(midiToName(69)).toBe('A4'));
  it('36 = C2', () => expect(midiToName(36)).toBe('C2'));
  it('0 = C-1', () => expect(midiToName(0)).toBe('C-1'));
});

describe('isBlackKey', () => {
  const blackMod = [1, 3, 6, 8, 10];
  const whiteMod = [0, 2, 4, 5, 7, 9, 11];

  it.each(blackMod)('pitch mod 12 = %i is black', (mod) => {
    expect(isBlackKey(mod)).toBe(true);     // below C1
    expect(isBlackKey(mod + 12)).toBe(true); // one octave up
  });

  it.each(whiteMod)('pitch mod 12 = %i is white', (mod) => {
    expect(isBlackKey(mod)).toBe(false);
    expect(isBlackKey(mod + 12)).toBe(false);
  });
});

describe('beatsToSeconds', () => {
  it('1 beat at 120 bpm = 0.5 s', () => {
    expect(beatsToSeconds(1, 120)).toBeCloseTo(0.5);
  });

  it('4 beats at 60 bpm = 4 s', () => {
    expect(beatsToSeconds(4, 60)).toBeCloseTo(4);
  });

  it('0 beats = 0 s', () => {
    expect(beatsToSeconds(0, 120)).toBe(0);
  });

  it('scales linearly with beat count', () => {
    expect(beatsToSeconds(2, 120)).toBeCloseTo(beatsToSeconds(1, 120) * 2);
  });
});

describe('formatBeatTime', () => {
  it('beat 0 = "1.1"', () => expect(formatBeatTime(0)).toBe('1.1'));
  it('beat 1 = "1.2"', () => expect(formatBeatTime(1)).toBe('1.2'));
  it('beat 3 = "1.4"', () => expect(formatBeatTime(3)).toBe('1.4'));
  it('beat 4 = "2.1"', () => expect(formatBeatTime(4)).toBe('2.1'));
  it('beat 5 = "2.2"', () => expect(formatBeatTime(5)).toBe('2.2'));
  it('beat 8 = "3.1"', () => expect(formatBeatTime(8)).toBe('3.1'));
});
