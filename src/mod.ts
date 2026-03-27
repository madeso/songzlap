/**
 * ProTracker .MOD file parser — two-stage design:
 *   parseMod()      → ModFile  (raw binary data, no app types)
 *   modToAppState() → AppState (internal song structure)
 */
import type { AppState, Track, Clip, Instrument, Note, Placement, SampleData } from './types';
import { TRACK_COLORS } from './constants';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// Raw MOD format interfaces
// ---------------------------------------------------------------------------

/** One 30-byte sample descriptor from the MOD header. */
export interface ModSampleHeader {
  /** Sample name (up to 22 chars). Names starting with '#' are often messages. */
  name: string;
  /** Length in words (1 word = 2 bytes). 0 = empty/unused sample. */
  lengthWords: number;
  /** Finetune value −8..7 (each step = 1/8 semitone). */
  finetune: number;
  /** Volume 0–64. */
  volume: number;
  /** Loop start offset in words. */
  loopStartWords: number;
  /** Loop length in words. Loop is active only when > 1. */
  loopLengthWords: number;
}

/** One channel's data within a single pattern row (4 bytes). */
export interface ModCell {
  /** Sample number 1–31; 0 = continue previous sample on this channel. */
  sample: number;
  /** Amiga period (12-bit). 0 = no new note trigger. */
  period: number;
  /** Effect number 0–15 (high nibble = 14 uses param high nibble as sub-command). */
  effect: number;
  /** Effect parameter byte 0–255 (two nibbles x and y). */
  param: number;
}

/** The complete parsed MOD file — raw binary data with no internal app types. */
export interface ModFile {
  /** Song title (up to 20 chars). */
  title: string;
  /** 15 for old Soundtracker/Noisetracker files; 31 for Protracker (M.K. etc.). */
  numSamples: 15 | 31;
  /** Number of channels: 4 (M.K./FLT4/4CHN), 6 (6CHN), or 8 (FLT8/8CHN). */
  numChannels: number;
  /** Format tag string e.g. "M.K.", "M!K!", "FLT4", "8CHN". Empty for 15-sample files. */
  tag: string;
  /** Sample headers — numSamples entries (index 0 = sample 1). */
  samples: ModSampleHeader[];
  /** Raw signed 8-bit PCM data per sample. samplePcm[i] matches samples[i]. */
  samplePcm: Int8Array[];
  /** Number of active entries in patternOrder. Legal range 1–128. */
  songLength: number;
  /** Byte historically set to 127; some trackers use it as a restart position. */
  restartPosition: number;
  /** 128-entry playback order table — only first songLength entries are played. */
  patternOrder: number[];
  /** Pattern data: patterns[patternIndex][row 0..63][channel 0..numChannels−1]. */
  patterns: ModCell[][][];
  /** Initial BPM (default 125; may be set by an Fxx effect on the first row). */
  initialBpm: number;
  /** Initial ticks per row (default 6; may be set by an Fxx effect on the first row). */
  initialTicksPerRow: number;
}

// ---------------------------------------------------------------------------
// Binary helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// parseMod — binary → ModFile
// ---------------------------------------------------------------------------

/**
 * Parse a .MOD ArrayBuffer into a typed ModFile.
 * Supports 15-sample (no tag) and 31-sample (M.K., M!K!, FLT4, etc.) formats,
 * and 4, 6, or 8 channel MODs.
 */
export function parseMod(arrayBuffer: ArrayBuffer): ModFile {
  const buf = new DataView(arrayBuffer);

  // Detect 15- vs 31-sample format from the 4-byte tag at offset 1080.
  // For 31-sample files this offset holds a known ASCII tag; for 15-sample
  // files offset 1080 is already inside pattern data.
  const KNOWN_TAGS = ['M.K.', 'M!K!', 'FLT4', 'FLT8', '4CHN', '6CHN', '8CHN'];
  const candidateTag = String.fromCharCode(
    buf.getUint8(1080), buf.getUint8(1081), buf.getUint8(1082), buf.getUint8(1083),
  );
  const numSamples: 15 | 31 = KNOWN_TAGS.includes(candidateTag) ? 31 : 15;
  const tag = numSamples === 31 ? candidateTag : '';

  // Channel count from tag
  let numChannels = 4;
  if (tag === 'FLT8' || tag === '8CHN') numChannels = 8;
  else if (tag === '6CHN') numChannels = 6;

  // Sample headers: numSamples × 30 bytes starting at byte 20
  const samples: ModSampleHeader[] = [];
  for (let i = 0; i < numSamples; i++) {
    const base = 20 + i * 30;
    const finetuneByte = buf.getUint8(base + 24) & 0x0f;
    samples.push({
      name: readStr(buf, base, 22),
      lengthWords: readU16BE(buf, base + 22),
      finetune: finetuneByte >= 8 ? finetuneByte - 16 : finetuneByte,
      volume: buf.getUint8(base + 25),
      loopStartWords: readU16BE(buf, base + 26),
      loopLengthWords: readU16BE(buf, base + 28),
    });
  }

  // Song metadata follows the sample headers: 1 + 1 + 128 = 130 bytes
  const metaBase = 20 + numSamples * 30;
  const songLength = buf.getUint8(metaBase);
  const restartPosition = buf.getUint8(metaBase + 1);
  const patternOrder = Array.from({ length: 128 }, (_, i) => buf.getUint8(metaBase + 2 + i));

  // Pattern data offset: after metadata + tag (4 bytes only for 31-sample files)
  const patternDataOffset = metaBase + 130 + (numSamples === 31 ? 4 : 0);
  const numPatterns = Math.max(...patternOrder.slice(0, songLength)) + 1;

  const ROWS_PER_PATTERN = 64;
  const BYTES_PER_PATTERN = ROWS_PER_PATTERN * numChannels * 4;

  // Parse all patterns
  const patterns: ModCell[][][] = [];
  for (let p = 0; p < numPatterns; p++) {
    const pat: ModCell[][] = [];
    for (let row = 0; row < ROWS_PER_PATTERN; row++) {
      const rowCells: ModCell[] = [];
      for (let ch = 0; ch < numChannels; ch++) {
        const off = patternDataOffset + p * BYTES_PER_PATTERN + (row * numChannels + ch) * 4;
        const b0 = buf.getUint8(off);
        const b1 = buf.getUint8(off + 1);
        const b2 = buf.getUint8(off + 2);
        const b3 = buf.getUint8(off + 3);
        rowCells.push({
          sample: (b0 & 0xf0) | ((b2 & 0xf0) >> 4),
          period: ((b0 & 0x0f) << 8) | b1,
          effect: b2 & 0x0f,
          param: b3,
        });
      }
      pat.push(rowCells);
    }
    patterns.push(pat);
  }

  // PCM data follows all patterns
  let pcmOffset = patternDataOffset + numPatterns * BYTES_PER_PATTERN;
  const samplePcm: Int8Array[] = [];
  for (let i = 0; i < numSamples; i++) {
    const len = samples[i].lengthWords * 2;
    // Use slice() to get an independent copy, not a view into the original buffer
    samplePcm.push(new Int8Array(arrayBuffer, pcmOffset, len).slice());
    pcmOffset += len;
  }

  // Scan row 0 of pattern 0 for an initial Fxx (Set Speed) effect.
  // Fxx where x ≤ 32 sets ticks/row; x > 32 sets BPM.
  let initialBpm = 125;
  let initialTicksPerRow = 6;
  if (patterns.length > 0) {
    for (const cell of patterns[0][0]) {
      if (cell.effect === 0xf && cell.param > 0) {
        if (cell.param <= 32) initialTicksPerRow = cell.param;
        else initialBpm = cell.param;
      }
    }
  }

  return {
    title: readStr(buf, 0, 20),
    numSamples,
    numChannels,
    tag,
    samples,
    samplePcm,
    songLength,
    restartPosition,
    patternOrder,
    patterns,
    initialBpm,
    initialTicksPerRow,
  };
}

// ---------------------------------------------------------------------------
// modToAppState — ModFile → internal AppState
// ---------------------------------------------------------------------------

/**
 * Convert a parsed MOD period value to a MIDI note number.
 * Period 214 = MIDI 60 (C4/middle C), period 428 = MIDI 48 (C3), etc.
 */
function periodToMidi(period: number): number {
  if (period === 0) return -1;
  return Math.round(60 - 12 * Math.log2(period / 214));
}

/**
 * Map a ModFile to the internal song AppState.
 * Each MOD channel becomes a Track.  Per-(pattern, channel) Clips are created
 * so each track plays only its own channel's notes.
 */
export function modToAppState(
  mod: ModFile,
): Omit<AppState, 'playing' | 'openClipId' | 'openInstrumentId'> {
  // Standard mapping: 4 rows = 1 beat (24 / ticksPerRow for default 6 → 4).
  // DAW BPM = 6 * initialBpm / initialTicksPerRow (= 125 for defaults).
  const ROWS_PER_BEAT = 4;
  const BEATS_PER_ROW = 1 / ROWS_PER_BEAT;
  const ROWS_PER_PATTERN = 64;
  const PATTERN_BEATS = ROWS_PER_PATTERN * BEATS_PER_ROW; // 16 beats

  const bpm = Math.round(6 * mod.initialBpm / mod.initialTicksPerRow);

  // --- Instruments from sample headers ---
  const instruments: Record<string, Instrument> = {};
  for (let i = 0; i < mod.numSamples; i++) {
    const hdr = mod.samples[i];
    if (hdr.lengthWords === 0) continue;
    const id = `mod_sample_${i + 1}`;
    const sampleData: SampleData = {
      pcm: Array.from(mod.samplePcm[i]),
      sampleRate: 8363,                               // Amiga C4 standard rate
      loopStart: hdr.loopStartWords * 2,
      loopLength: hdr.loopLengthWords > 1 ? hdr.loopLengthWords * 2 : 0,
      finetune: hdr.finetune,
      baseNote: 60,                                   // period 214 → MIDI 60 (C4)
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

  // --- Per-(pattern, channel) clips ---
  // Pre-generate IDs so placements can reference them by index
  const clipIds: string[][] = Array.from(
    { length: mod.patterns.length },
    () => Array.from({ length: mod.numChannels }, () => uid()),
  );
  const clips: Record<string, Clip> = {};

  for (let p = 0; p < mod.patterns.length; p++) {
    for (let ch = 0; ch < mod.numChannels; ch++) {
      const notes: Note[] = [];
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
        const hdr = mod.samples[noteSample - 1];
        const velocity = Math.min(1, (hdr?.volume ?? 64) / 64);
        notes.push({ id: uid(), pitch: midi, beat, duration, velocity });
      };

      for (let row = 0; row < ROWS_PER_PATTERN; row++) {
        const cell = mod.patterns[p][row][ch];
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

      const clipId = clipIds[p][ch];
      clips[clipId] = { id: clipId, notes, lengthBeats: PATTERN_BEATS };
    }
  }

  // --- Dominant instrument per channel (most-used sample across all positions) ---
  const channelInstrId: string[] = Array.from({ length: mod.numChannels }, () => fallbackId);
  for (let ch = 0; ch < mod.numChannels; ch++) {
    const freq: Record<number, number> = {};
    for (let pos = 0; pos < mod.songLength; pos++) {
      const pat = mod.patternOrder[pos];
      for (let row = 0; row < ROWS_PER_PATTERN; row++) {
        const s = mod.patterns[pat][row][ch].sample;
        if (s > 0) freq[s] = (freq[s] ?? 0) + 1;
      }
    }
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const instrId = `mod_sample_${dominant[0]}`;
      if (instruments[instrId]) channelInstrId[ch] = instrId;
    }
  }

  // --- Tracks: one per channel, placements use per-channel clip IDs ---
  const titlePrefix = mod.title ? `${mod.title} – ` : '';
  const tracks: Track[] = Array.from({ length: mod.numChannels }, (_, ch) => {
    const placements: Placement[] = [];
    let startBeat = 0;
    for (let pos = 0; pos < mod.songLength; pos++) {
      const pat = mod.patternOrder[pos];
      placements.push({ id: uid(), clipId: clipIds[pat][ch], startBeat });
      startBeat += PATTERN_BEATS;
    }
    return {
      id: uid(),
      name: `${titlePrefix}Ch ${ch + 1}`,
      instrumentId: channelInstrId[ch],
      placements,
      muted: false,
      color: TRACK_COLORS[ch % TRACK_COLORS.length],
    };
  });

  return {
    bpm,
    tracks,
    clips,
    instruments,
    playbackMode: 'song',
    selectedTrackId: null,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: mod.songLength * PATTERN_BEATS,
  };
}
