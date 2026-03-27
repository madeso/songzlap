/**
 * ProTracker .MOD file parser — two-stage design:
 *   parseMod()      → ModFile  (raw binary data, no app types)
 *   modToAppState() → AppState (internal song structure)
 */
import type { AppState, Track, Clip, Instrument, Note, NoteAutomation, Placement, SampleData } from './types';
import { TRACK_COLORS } from './constants';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// MOD effect discriminated union
// ---------------------------------------------------------------------------

/**
 * A fully-decoded MOD pattern effect.  Every `ModCell` carries exactly one
 * `ModEffect`; if no effect is present the cell has `{ kind: 'none' }`.
 */
export type ModEffect =
  | { kind: 'none' }
  | { kind: 'arpeggio';              x: number; y: number }
  | { kind: 'slideUp';               speed: number }
  | { kind: 'slideDown';             speed: number }
  | { kind: 'slideToNote';           speed: number }      // speed=0 → continue last
  | { kind: 'vibrato';               speed: number; depth: number }
  | { kind: 'slideToNoteVolSlide';   volUp: number; volDown: number }
  | { kind: 'vibratoVolSlide';       volUp: number; volDown: number }
  | { kind: 'tremolo';               speed: number; depth: number }
  | { kind: 'setPanning';            position: number }   // 0–128 (64=centre)
  | { kind: 'setSampleOffset';       offset: number }     // words (×2 = bytes)
  | { kind: 'volumeSlide';           volUp: number; volDown: number }
  | { kind: 'positionJump';          position: number }
  | { kind: 'setVolume';             volume: number }     // 0–64
  | { kind: 'patternBreak';          startRow: number }   // row = x*10+y
  | { kind: 'fineSlideUp';           amount: number }
  | { kind: 'fineSlideDown';         amount: number }
  | { kind: 'setGlissando';          on: boolean }
  | { kind: 'setVibratoWaveform';    waveform: number }
  | { kind: 'setFinetune';           finetune: number }   // signed nibble
  | { kind: 'loopPattern';           count: number }      // 0=set start, else jump
  | { kind: 'setTremoloWaveform';    waveform: number }
  | { kind: 'retrigerSample';        interval: number }
  | { kind: 'fineVolumeSlideUp';     amount: number }
  | { kind: 'fineVolumeSlideDown';   amount: number }
  | { kind: 'cutSample';             tick: number }
  | { kind: 'delaySample';           ticks: number }
  | { kind: 'delayPattern';          count: number }
  | { kind: 'invertLoop';            speed: number }
  | { kind: 'setSpeed';              ticksPerRow: number }
  | { kind: 'setBpm';                bpm: number };

/** Decode raw effect nibble (0–15) and parameter byte into a `ModEffect`. */
function decodeEffect(nibble: number, param: number): ModEffect {
  const hi = param >> 4;
  const lo = param & 0x0f;
  switch (nibble) {
    case 0:  return param === 0 ? { kind: 'none' } : { kind: 'arpeggio', x: hi, y: lo };
    case 1:  return { kind: 'slideUp', speed: param };
    case 2:  return { kind: 'slideDown', speed: param };
    case 3:  return { kind: 'slideToNote', speed: param };
    case 4:  return { kind: 'vibrato', speed: hi, depth: lo };
    case 5:  return { kind: 'slideToNoteVolSlide', volUp: hi, volDown: lo };
    case 6:  return { kind: 'vibratoVolSlide', volUp: hi, volDown: lo };
    case 7:  return { kind: 'tremolo', speed: hi, depth: lo };
    case 8:  return { kind: 'setPanning', position: param };
    case 9:  return { kind: 'setSampleOffset', offset: param };
    case 10: return { kind: 'volumeSlide', volUp: hi, volDown: lo };
    case 11: return { kind: 'positionJump', position: param };
    case 12: return { kind: 'setVolume', volume: Math.min(64, param) };
    case 13: return { kind: 'patternBreak', startRow: Math.min(63, hi * 10 + lo) };
    case 14:
      switch (hi) {
        case 0:  return { kind: 'none' }; // set filter — hardware only
        case 1:  return { kind: 'fineSlideUp', amount: lo };
        case 2:  return { kind: 'fineSlideDown', amount: lo };
        case 3:  return { kind: 'setGlissando', on: lo !== 0 };
        case 4:  return { kind: 'setVibratoWaveform', waveform: lo };
        case 5:  return { kind: 'setFinetune', finetune: lo >= 8 ? lo - 16 : lo };
        case 6:  return { kind: 'loopPattern', count: lo };
        case 7:  return { kind: 'setTremoloWaveform', waveform: lo };
        case 8:  return { kind: 'none' };
        case 9:  return { kind: 'retrigerSample', interval: lo };
        case 10: return { kind: 'fineVolumeSlideUp', amount: lo };
        case 11: return { kind: 'fineVolumeSlideDown', amount: lo };
        case 12: return { kind: 'cutSample', tick: lo };
        case 13: return { kind: 'delaySample', ticks: lo };
        case 14: return { kind: 'delayPattern', count: lo };
        case 15: return { kind: 'invertLoop', speed: lo };
        default: return { kind: 'none' };
      }
    case 15: return param === 0 || param > 32
      ? { kind: 'setBpm', bpm: param === 0 ? 125 : param }
      : { kind: 'setSpeed', ticksPerRow: param };
    default: return { kind: 'none' };
  }
}

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
  /** Decoded effect for this cell. */
  effect: ModEffect;
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
  /** Initial BPM (default 125; may be set by a setBpm/setSpeed effect on the first row). */
  initialBpm: number;
  /** Initial ticks per row (default 6; may be set by a setSpeed effect on the first row). */
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
          effect: decodeEffect(b2 & 0x0f, b3),
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

  // Scan row 0 of the FIRST pattern in the song order for initial setSpeed/setBpm.
  let initialBpm = 125;
  let initialTicksPerRow = 6;
  if (patterns.length > 0 && songLength > 0) {
    const firstPat = patternOrder[0];
    if (firstPat < patterns.length) {
      for (const cell of patterns[firstPat][0]) {
        if (cell.effect.kind === 'setSpeed') initialTicksPerRow = cell.effect.ticksPerRow;
        else if (cell.effect.kind === 'setBpm') initialBpm = cell.effect.bpm;
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

/** Convert Amiga period to semitone shift relative to a reference period. */
function periodToSemitones(period: number, refPeriod: number): number {
  if (period <= 0 || refPeriod <= 0) return 0;
  return -12 * Math.log2(period / refPeriod);
}

/** Per-channel running state used when computing automation in modToAppState. */
interface ChannelState {
  volume: number;          // 0–64 (current channel volume)
  period: number;          // current Amiga period
  lastSlideSpeed: number;  // last slide-up/down speed (for effects 5/3 continue)
  lastSlideTarget: number; // target period for effect 3
  lastVibratoSpeed: number;
  lastVibratoDepth: number;
  vibratoPhase: number;    // 0..1 cycles
  lastTremoloSpeed: number;
  lastTremoloDepth: number;
  tremoloPhase: number;
  ticksPerRow: number;
  bpm: number;
}

/**
 * Map a ModFile to the internal song AppState.
 * Each MOD channel becomes a Track.  Per-(pattern, channel) Clips are created
 * so each track plays only its own channel's notes.
 * All supported MOD effects are pre-computed into NoteAutomation curves.
 */
export function modToAppState(
  mod: ModFile,
): Omit<AppState, 'playing' | 'openClipId' | 'openInstrumentId'> {
  // Standard mapping: 4 rows = 1 beat (24/ticksPerRow for default 6 → 4).
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
      sampleRate: 8363,
      loopStart: hdr.loopStartWords * 2,
      loopLength: hdr.loopLengthWords > 1 ? hdr.loopLengthWords * 2 : 0,
      finetune: hdr.finetune,
      baseNote: 60,
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

  // --- Per-(pattern, channel) clips with full effect automation ---
  const clipIds: string[][] = Array.from(
    { length: mod.patterns.length },
    () => Array.from({ length: mod.numChannels }, () => uid()),
  );
  const clips: Record<string, Clip> = {};

  for (let p = 0; p < mod.patterns.length; p++) {
    // Find the earliest pattern break row (Dxx) across all channels
    let patternEndRow = ROWS_PER_PATTERN;
    for (let ch2 = 0; ch2 < mod.numChannels; ch2++) {
      for (let row = 0; row < ROWS_PER_PATTERN; row++) {
        const eff = mod.patterns[p][row][ch2].effect;
        if (eff.kind === 'patternBreak') {
          patternEndRow = Math.min(patternEndRow, row + 1);
          break;
        }
      }
    }
    const clipLengthBeats = patternEndRow * BEATS_PER_ROW;

    for (let ch = 0; ch < mod.numChannels; ch++) {
      const notes: Note[] = [];
      let lastSample = 0;
      let noteStart = -1;
      let notePeriod = 0;
      let noteSample = 0;

      // Per-channel running state (carries across rows for stateful effects)
      const cs: ChannelState = {
        volume: 64,
        period: 0,
        lastSlideSpeed: 0,
        lastSlideTarget: 0,
        lastVibratoSpeed: 1,
        lastVibratoDepth: 1,
        vibratoPhase: 0,
        lastTremoloSpeed: 1,
        lastTremoloDepth: 1,
        tremoloPhase: 0,
        ticksPerRow: mod.initialTicksPerRow,
        bpm: mod.initialBpm,
      };

      const commitNote = (endRow: number) => {
        if (noteStart < 0 || notePeriod === 0 || noteSample === 0) return;
        const midi = periodToMidi(notePeriod);
        if (midi < 0 || midi > 127) return;
        const beat = noteStart * BEATS_PER_ROW;
        const rawDuration = (endRow - noteStart) * BEATS_PER_ROW;
        const duration = Math.max(rawDuration, BEATS_PER_ROW);

        // --- Build automation from effects in rows [noteStart, endRow) ---
        const pitchPoints: [number, number][] = [];
        const volumePoints: [number, number][] = [];
        let pan: number | undefined;
        let sampleOffset: number | undefined;
        let startDelayBeats: number | undefined;

        // Snapshot starting volume; use sample header as baseline
        const hdr = mod.samples[noteSample - 1];
        let runVolume = hdr?.volume ?? 64;
        let runPeriod = notePeriod;

        // Local copies of vibrato/tremolo phase so the note's automation
        // is deterministic regardless of loop iteration
        let vibratoPhase = cs.vibratoPhase;
        let tremoloPhase = cs.tremoloPhase;
        let lastSlideSpeed = cs.lastSlideSpeed;
        let lastSlideTarget = cs.lastSlideTarget;
        let lastVibratoSpeed = cs.lastVibratoSpeed;
        let lastVibratoDepth = cs.lastVibratoDepth;
        let lastTremoloSpeed = cs.lastTremoloSpeed;
        let lastTremoloDepth = cs.lastTremoloDepth;

        for (let r = noteStart; r < endRow; r++) {
          const cell = mod.patterns[p][r][ch];
          const rowBeat = (r - noteStart) * BEATS_PER_ROW;
          const beatsPerTick = BEATS_PER_ROW / cs.ticksPerRow;
          const eff = cell.effect;

          switch (eff.kind) {
            case 'arpeggio': {
              for (let tick = 0; tick < cs.ticksPerRow; tick++) {
                const shift = tick % 3 === 0 ? 0 : tick % 3 === 1 ? eff.x : eff.y;
                pitchPoints.push([rowBeat + tick * beatsPerTick, shift]);
              }
              break;
            }
            case 'slideUp': {
              const speed = eff.speed || lastSlideSpeed;
              lastSlideSpeed = speed;
              for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                runPeriod = Math.max(113, runPeriod - speed);
                pitchPoints.push([rowBeat + tick * beatsPerTick, periodToSemitones(runPeriod, notePeriod)]);
              }
              break;
            }
            case 'slideDown': {
              const speed = eff.speed || lastSlideSpeed;
              lastSlideSpeed = speed;
              for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                runPeriod = Math.min(856, runPeriod + speed);
                pitchPoints.push([rowBeat + tick * beatsPerTick, periodToSemitones(runPeriod, notePeriod)]);
              }
              break;
            }
            case 'slideToNote': {
              if (cell.period > 0) lastSlideTarget = cell.period;
              const speed = eff.speed || lastSlideSpeed;
              if (speed > 0) lastSlideSpeed = speed;
              if (lastSlideTarget > 0 && speed > 0) {
                const dir = lastSlideTarget < runPeriod ? -1 : 1;
                for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                  if (dir < 0) runPeriod = Math.max(lastSlideTarget, runPeriod - speed);
                  else runPeriod = Math.min(lastSlideTarget, runPeriod + speed);
                  pitchPoints.push([rowBeat + tick * beatsPerTick, periodToSemitones(runPeriod, notePeriod)]);
                }
              }
              break;
            }
            case 'vibrato': {
              if (eff.speed !== 0) lastVibratoSpeed = eff.speed;
              if (eff.depth !== 0) lastVibratoDepth = eff.depth;
              for (let tick = 0; tick < cs.ticksPerRow; tick++) {
                const semAmp = lastVibratoDepth / 8;
                pitchPoints.push([rowBeat + tick * beatsPerTick, Math.sin(vibratoPhase * Math.PI * 2) * semAmp]);
                vibratoPhase = (vibratoPhase + lastVibratoSpeed / 64) % 1;
              }
              break;
            }
            case 'slideToNoteVolSlide': {
              // Continue last slide
              if (lastSlideTarget > 0 && lastSlideSpeed > 0) {
                const dir = lastSlideTarget < runPeriod ? -1 : 1;
                for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                  if (dir < 0) runPeriod = Math.max(lastSlideTarget, runPeriod - lastSlideSpeed);
                  else runPeriod = Math.min(lastSlideTarget, runPeriod + lastSlideSpeed);
                  pitchPoints.push([rowBeat + tick * beatsPerTick, periodToSemitones(runPeriod, notePeriod)]);
                }
              }
              const volChange = eff.volUp > 0 ? eff.volUp : -eff.volDown;
              for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                runVolume = Math.max(0, Math.min(64, runVolume + volChange));
                volumePoints.push([rowBeat + tick * beatsPerTick, runVolume / 64]);
              }
              break;
            }
            case 'vibratoVolSlide': {
              // Continue last vibrato
              for (let tick = 0; tick < cs.ticksPerRow; tick++) {
                const semAmp = lastVibratoDepth / 8;
                pitchPoints.push([rowBeat + tick * beatsPerTick, Math.sin(vibratoPhase * Math.PI * 2) * semAmp]);
                vibratoPhase = (vibratoPhase + lastVibratoSpeed / 64) % 1;
              }
              const volChange = eff.volUp > 0 ? eff.volUp : -eff.volDown;
              for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                runVolume = Math.max(0, Math.min(64, runVolume + volChange));
                volumePoints.push([rowBeat + tick * beatsPerTick, runVolume / 64]);
              }
              break;
            }
            case 'tremolo': {
              if (eff.speed !== 0) lastTremoloSpeed = eff.speed;
              if (eff.depth !== 0) lastTremoloDepth = eff.depth;
              for (let tick = 0; tick < cs.ticksPerRow; tick++) {
                const volAmp = (lastTremoloDepth / 64) * runVolume;
                const vol = Math.max(0, Math.min(64, runVolume + Math.sin(tremoloPhase * Math.PI * 2) * volAmp));
                volumePoints.push([rowBeat + tick * beatsPerTick, vol / 64]);
                tremoloPhase = (tremoloPhase + lastTremoloSpeed / 64) % 1;
              }
              break;
            }
            case 'setPanning': {
              pan = (eff.position / 64) - 1; // 0..128 → -1..+1
              break;
            }
            case 'setSampleOffset': {
              sampleOffset = eff.offset * 256 * 2; // words → bytes → frames
              break;
            }
            case 'volumeSlide': {
              const volChange = (eff.volUp > 0 && eff.volDown > 0) ? eff.volUp
                : eff.volUp > 0 ? eff.volUp : -eff.volDown;
              for (let tick = 1; tick < cs.ticksPerRow; tick++) {
                runVolume = Math.max(0, Math.min(64, runVolume + volChange));
                volumePoints.push([rowBeat + tick * beatsPerTick, runVolume / 64]);
              }
              break;
            }
            case 'setVolume': {
              runVolume = eff.volume;
              volumePoints.push([rowBeat, runVolume / 64]);
              break;
            }
            case 'fineSlideUp': {
              runPeriod = Math.max(113, runPeriod - eff.amount);
              pitchPoints.push([rowBeat, periodToSemitones(runPeriod, notePeriod)]);
              break;
            }
            case 'fineSlideDown': {
              runPeriod = Math.min(856, runPeriod + eff.amount);
              pitchPoints.push([rowBeat, periodToSemitones(runPeriod, notePeriod)]);
              break;
            }
            case 'fineVolumeSlideUp': {
              runVolume = Math.min(64, runVolume + eff.amount);
              volumePoints.push([rowBeat, runVolume / 64]);
              break;
            }
            case 'fineVolumeSlideDown': {
              runVolume = Math.max(0, runVolume - eff.amount);
              volumePoints.push([rowBeat, runVolume / 64]);
              break;
            }
            case 'cutSample': {
              // Volume → 0 after tick x in this row
              const cutBeat = rowBeat + eff.tick * beatsPerTick;
              volumePoints.push([cutBeat, 0]);
              runVolume = 0;
              break;
            }
            case 'delaySample': {
              startDelayBeats = (startDelayBeats ?? 0) + eff.ticks * beatsPerTick;
              break;
            }
            case 'setSpeed': {
              cs.ticksPerRow = eff.ticksPerRow;
              break;
            }
            case 'setBpm': {
              cs.bpm = eff.bpm;
              break;
            }
            default:
              break;
          }
        }

        // Update running channel state for future rows
        cs.period = runPeriod;
        cs.volume = runVolume;
        cs.vibratoPhase = vibratoPhase;
        cs.tremoloPhase = tremoloPhase;
        cs.lastSlideSpeed = lastSlideSpeed;
        cs.lastSlideTarget = lastSlideTarget;
        cs.lastVibratoSpeed = lastVibratoSpeed;
        cs.lastVibratoDepth = lastVibratoDepth;
        cs.lastTremoloSpeed = lastTremoloSpeed;
        cs.lastTremoloDepth = lastTremoloDepth;

        const velocity = Math.min(1, runVolume / 64) || Math.min(1, (hdr?.volume ?? 64) / 64);
        const automation: NoteAutomation | undefined = (
          pitchPoints.length > 0 || volumePoints.length > 0 ||
          pan !== undefined || sampleOffset !== undefined || startDelayBeats !== undefined
        ) ? {
          pitchPoints: pitchPoints.length > 0 ? pitchPoints : undefined,
          volumePoints: volumePoints.length > 0 ? volumePoints : undefined,
          pan,
          sampleOffset,
          startDelayBeats,
        } : undefined;

        notes.push({ id: uid(), pitch: midi, beat, duration, velocity, automation });
      };

      for (let row = 0; row < patternEndRow; row++) {
        const cell = mod.patterns[p][row][ch];
        const sampleNum = cell.sample > 0 ? cell.sample : lastSample;
        if (cell.sample > 0) {
          lastSample = cell.sample;
          // Reinitialize volume from sample header when a new sample is selected
          cs.volume = mod.samples[cell.sample - 1]?.volume ?? 64;
        }
        if (cell.period > 0) {
          commitNote(row);
          noteStart = row;
          notePeriod = cell.period;
          noteSample = sampleNum;
        }
        // Update channel state for non-note effects (Cxx, Fxx etc. on rows without a new note)
        const eff = cell.effect;
        if (eff.kind === 'setVolume') cs.volume = eff.volume;
        if (eff.kind === 'setSpeed') cs.ticksPerRow = eff.ticksPerRow;
        if (eff.kind === 'setBpm') cs.bpm = eff.bpm;
      }
      commitNote(patternEndRow);

      const clipId = clipIds[p][ch];
      clips[clipId] = { id: clipId, notes, lengthBeats: clipLengthBeats };
    }
  }

  // --- Dominant instrument per channel ---
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

  // --- Tracks: one per channel ---
  const titlePrefix = mod.title ? `${mod.title} – ` : '';
  const tracks: Track[] = Array.from({ length: mod.numChannels }, (_, ch) => {
    const placements: Placement[] = [];
    let startBeat = 0;
    for (let pos = 0; pos < mod.songLength; pos++) {
      const pat = mod.patternOrder[pos];
      placements.push({ id: uid(), clipId: clipIds[pat][ch], startBeat });
      startBeat += clips[clipIds[pat][ch]]?.lengthBeats ?? PATTERN_BEATS;
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
