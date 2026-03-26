/**
 * ProTracker .MOD file parser.
 * Supports standard 4-channel M.K. MOD files.
 * Returns tracks, clips, instruments, and bpm suitable for LOAD_SONG.
 */
import type { AppState, Track, Clip, Instrument, Note, Placement, SampleData } from './types';
import { TRACK_COLORS } from './constants';
import { uid } from './utils';

function readStr(buf: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = buf.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

function readU16BE(buf: DataView, offset: number): number {
  return (buf.getUint8(offset) << 8) | buf.getUint8(offset + 1);
}

/** Convert Amiga MOD period to MIDI note number. */
function periodToMidi(period: number): number {
  if (period === 0) return -1;
  const freq = 7093789.2 / (period * 2);
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

/**
 * Parse a .MOD file buffer and return a partial AppState.
 * Each of the 4 channels becomes a Track; unique patterns become Clips.
 * Samples are stored as SampleData on the instruments.
 */
export function parseMod(arrayBuffer: ArrayBuffer): Omit<AppState, 'playing' | 'openClipId' | 'openInstrumentId'> {
  const buf = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  // Detect MOD format by tag at offset 1080
  const tag = readStr(buf, 1080, 4);
  const numChannels = 4; // M.K. = 4 channels
  const numSamples = 31; // standard ProTracker

  if (!['M.K.', 'M!K!', 'FLT4', '4CHN'].includes(tag) && tag !== '') {
    // May still be a valid MOD without a recognized tag — proceed anyway
  }

  // --- Sample headers (31 × 30 bytes starting at offset 20) ---
  interface SampleHeader {
    name: string;
    lengthWords: number;   // in words (×2 = bytes)
    finetune: number;      // lower 4 bits, signed -8..7
    volume: number;        // 0-64
    loopStartWords: number;
    loopLengthWords: number;
  }

  const sampleHeaders: SampleHeader[] = [];
  for (let i = 0; i < numSamples; i++) {
    const base = 20 + i * 30;
    const finetuneByte = buf.getUint8(base + 24) & 0x0f;
    const finetune = finetuneByte >= 8 ? finetuneByte - 16 : finetuneByte;
    sampleHeaders.push({
      name: readStr(buf, base, 22),
      lengthWords: readU16BE(buf, base + 22),
      finetune,
      volume: buf.getUint8(base + 25),
      loopStartWords: readU16BE(buf, base + 26),
      loopLengthWords: readU16BE(buf, base + 28),
    });
  }

  const songLength = buf.getUint8(950);   // number of positions in the pattern order
  const patternOrder = Array.from({ length: 128 }, (_, i) => buf.getUint8(952 + i));
  const numPatterns = Math.max(...patternOrder.slice(0, songLength)) + 1;

  // --- Pattern data ---
  const patternDataOffset = 1084; // after tag
  // Each pattern: 64 rows × 4 channels × 4 bytes
  const ROWS_PER_PATTERN = 64;
  const BYTES_PER_ROW_CHANNEL = 4;
  const BYTES_PER_PATTERN = ROWS_PER_PATTERN * numChannels * BYTES_PER_ROW_CHANNEL;

  interface Cell {
    sample: number;   // 1-31, 0=no sample
    period: number;   // Amiga period (0=no note)
    effect: number;
    param: number;
  }

  function readCell(offset: number): Cell {
    const b0 = buf.getUint8(offset);
    const b1 = buf.getUint8(offset + 1);
    const b2 = buf.getUint8(offset + 2);
    const b3 = buf.getUint8(offset + 3);
    const sample = ((b0 & 0xf0) | ((b2 & 0xf0) >> 4));
    const period = ((b0 & 0x0f) << 8) | b1;
    const effect = b2 & 0x0f;
    const param = b3;
    return { sample, period, effect, param };
  }

  // patterns[patternIndex][row][channel] = Cell
  const patterns: Cell[][][] = [];
  for (let p = 0; p < numPatterns; p++) {
    const pat: Cell[][] = [];
    for (let row = 0; row < ROWS_PER_PATTERN; row++) {
      const rowCells: Cell[] = [];
      for (let ch = 0; ch < numChannels; ch++) {
        const offset = patternDataOffset + p * BYTES_PER_PATTERN + row * numChannels * BYTES_PER_ROW_CHANNEL + ch * BYTES_PER_ROW_CHANNEL;
        rowCells.push(readCell(offset));
      }
      pat.push(rowCells);
    }
    patterns.push(pat);
  }

  // --- Sample PCM data ---
  let sampleDataOffset = patternDataOffset + numPatterns * BYTES_PER_PATTERN;
  const samplePcm: number[][] = [];
  for (let i = 0; i < numSamples; i++) {
    const len = sampleHeaders[i].lengthWords * 2;
    const pcm: number[] = [];
    for (let j = 0; j < len; j++) {
      const b = bytes[sampleDataOffset + j];
      pcm.push(b >= 128 ? b - 256 : b); // signed 8-bit
    }
    samplePcm.push(pcm);
    sampleDataOffset += len;
  }

  // --- Build instruments from samples ---
  // BPM in MOD: default tempo is 125, speed 6 ticks/row → 4 rows per beat
  const bpm = 125;
  const BEATS_PER_ROW = 0.25; // 4 rows per beat at speed 6 / BPM 125
  const PATTERN_BEATS = ROWS_PER_PATTERN * BEATS_PER_ROW; // 16 beats per pattern

  const instruments: Record<string, Instrument> = {};
  for (let i = 0; i < numSamples; i++) {
    const hdr = sampleHeaders[i];
    if (hdr.lengthWords === 0) continue;
    const id = `mod_sample_${i + 1}`;
    const loopLen = hdr.loopLengthWords > 1 ? hdr.loopLengthWords * 2 : 0;
    const sampleData: SampleData = {
      pcm: samplePcm[i],
      sampleRate: 8363,   // standard Amiga MOD C-3 sample rate
      loopStart: hdr.loopStartWords * 2,
      loopLength: loopLen,
      finetune: hdr.finetune,
      baseNote: 48,       // C-3
    };
    instruments[id] = {
      id,
      name: hdr.name || `Sample ${i + 1}`,
      type: 'sample',
      osc: 'sine',
      attack: 0.001,
      decay: 0.0,
      sustain: 1.0,
      release: 0.05,
      sample: sampleData,
    };
  }

  // Fallback instrument for channels with no samples
  const fallbackId = 'mod_osc_fallback';
  instruments[fallbackId] = {
    id: fallbackId,
    name: 'MOD Fallback',
    type: 'osc',
    osc: 'square',
    attack: 0.01,
    decay: 0.05,
    sustain: 0.8,
    release: 0.1,
  };

  // --- Build clips from unique patterns ---
  // One clip per pattern index
  const clipMap: Record<number, Clip> = {};
  for (let p = 0; p < numPatterns; p++) {
    const clipId = uid();
    const notes: Note[] = [];

    for (let ch = 0; ch < numChannels; ch++) {
      let lastSample = 0;
      let noteStart = -1;
      let notePeriod = 0;
      let noteSample = 0;

      const commitNote = (endRow: number) => {
        if (noteStart < 0 || notePeriod === 0 || noteSample === 0) return;
        const midi = periodToMidi(notePeriod);
        if (midi < 0 || midi > 127) return;
        const beat = noteStart * BEATS_PER_ROW;
        const duration = Math.max((endRow - noteStart) * BEATS_PER_ROW, BEATS_PER_ROW);
        const hdr = sampleHeaders[noteSample - 1];
        const velocity = Math.min(1, (hdr?.volume ?? 64) / 64);
        notes.push({ id: uid(), pitch: midi, beat, duration, velocity });
      };

      for (let row = 0; row < ROWS_PER_PATTERN; row++) {
        const cell = patterns[p][row][ch];
        const sampleNum = cell.sample > 0 ? cell.sample : lastSample;
        if (cell.sample > 0) lastSample = cell.sample;

        if (cell.period > 0) {
          commitNote(row);
          noteStart = row;
          notePeriod = cell.period;
          noteSample = sampleNum;
        }
      }
      commitNote(ROWS_PER_PATTERN);
    }

    clipMap[p] = { id: clipId, notes, lengthBeats: PATTERN_BEATS };
  }

  // --- Build 4 tracks with placements following pattern order ---
  const clips: Record<string, Clip> = {};
  for (const clip of Object.values(clipMap)) clips[clip.id] = clip;

  // Assign instruments to channels (use most frequent sample per channel)
  const channelInstrId: string[] = Array.from({ length: numChannels }, () => fallbackId);
  for (let ch = 0; ch < numChannels; ch++) {
    const freq: Record<number, number> = {};
    for (let pos = 0; pos < songLength; pos++) {
      const pat = patternOrder[pos];
      for (let row = 0; row < ROWS_PER_PATTERN; row++) {
        const s = patterns[pat][row][ch].sample;
        if (s > 0) freq[s] = (freq[s] ?? 0) + 1;
      }
    }
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const instrId = `mod_sample_${dominant[0]}`;
      if (instruments[instrId]) channelInstrId[ch] = instrId;
    }
  }

  const tracks: Track[] = Array.from({ length: numChannels }, (_, ch) => {
    const placements: Placement[] = [];
    let startBeat = 0;
    for (let pos = 0; pos < songLength; pos++) {
      const pat = patternOrder[pos];
      const clip = clipMap[pat];
      placements.push({ id: uid(), clipId: clip.id, startBeat });
      startBeat += PATTERN_BEATS;
    }
    return {
      id: uid(),
      name: `Channel ${ch + 1}`,
      instrumentId: channelInstrId[ch],
      placements,
      muted: false,
      color: TRACK_COLORS[ch % TRACK_COLORS.length],
    };
  });

  const loopEnd = songLength * PATTERN_BEATS;

  return {
    bpm,
    tracks,
    clips,
    instruments,
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: false,
    loopStart: 0,
    loopEnd,
  };
}
