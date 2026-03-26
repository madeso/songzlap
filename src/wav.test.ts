import { encodeWAV } from './wav';

/** Build a minimal fake AudioBuffer for testing — no Web Audio API needed. */
function makeBuffer(frames: number, channels: number, sampleRate: number): AudioBuffer {
  const channelArrays = Array.from({ length: channels }, () => new Float32Array(frames));
  return {
    numberOfChannels: channels,
    sampleRate,
    length: frames,
    duration: frames / sampleRate,
    getChannelData: (ch: number) => channelArrays[ch],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

function readStr(view: DataView, offset: number, len: number): string {
  return Array.from({ length: len }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');
}

describe('encodeWAV', () => {
  const FRAMES = 100;
  const CHANNELS = 2;
  const SAMPLE_RATE = 44100;

  let blob: Blob;
  let view: DataView;

  beforeEach(async () => {
    blob = encodeWAV(makeBuffer(FRAMES, CHANNELS, SAMPLE_RATE));
    const ab = await blob.arrayBuffer();
    view = new DataView(ab);
  });

  it('returns a Blob with type audio/wav', () => {
    expect(blob.type).toBe('audio/wav');
  });

  it('has correct total size (44-byte header + PCM data)', () => {
    const expected = 44 + FRAMES * CHANNELS * 2;
    expect(blob.size).toBe(expected);
  });

  it('starts with RIFF marker', () => {
    expect(readStr(view, 0, 4)).toBe('RIFF');
  });

  it('has WAVE format marker', () => {
    expect(readStr(view, 8, 4)).toBe('WAVE');
  });

  it('has fmt  sub-chunk', () => {
    expect(readStr(view, 12, 4)).toBe('fmt ');
  });

  it('has data sub-chunk', () => {
    expect(readStr(view, 36, 4)).toBe('data');
  });

  it('PCM format = 1 at byte 20', () => {
    expect(view.getUint16(20, true)).toBe(1);
  });

  it('channel count at byte 22', () => {
    expect(view.getUint16(22, true)).toBe(CHANNELS);
  });

  it('sample rate at byte 24', () => {
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
  });

  it('bits per sample = 16 at byte 34', () => {
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('data chunk size at byte 40', () => {
    expect(view.getUint32(40, true)).toBe(FRAMES * CHANNELS * 2);
  });

  it('RIFF chunk size at byte 4 = 36 + data size', () => {
    const dataSize = FRAMES * CHANNELS * 2;
    expect(view.getUint32(4, true)).toBe(36 + dataSize);
  });

  it('clamps sample values into int16 range', async () => {
    const buf = makeBuffer(1, 1, 44100);
    buf.getChannelData(0)[0] = 2.0; // over-range positive
    const b = encodeWAV(buf);
    const dv = new DataView(await b.arrayBuffer());
    const sample = dv.getInt16(44, true);
    expect(sample).toBe(0x7fff); // clamped to max int16
  });
});
