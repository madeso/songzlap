import type { Track, Clip, Instrument, Note } from './types';
import { midiToFreq, beatsToSeconds } from './utils';

export interface SchedulerOptions {
  loopEnabled: boolean;
  loopStart: number;           // beats
  loopEnd: number;             // beats
  playbackMode: 'song' | 'track';
  selectedTrackId: string | null;
  sampleCache: Record<string, AudioBuffer>;
  onStop?: () => void;
}

export interface Scheduler {
  tick(): void;
  stop(): void;
  getDisplayBeat(): number;
}

const LOOKAHEAD_SEC = 0.25;

function scheduleNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  note: Note,
  instr: Instrument,
  audioStartTime: number,
  bpm: number,
  sampleCache: Record<string, AudioBuffer>,
) {
  const secsPerBeat = 60 / bpm;

  // Apply startDelayBeats before anything else
  const delayBeats = note.automation?.startDelayBeats ?? 0;
  const startTime = audioStartTime + delayBeats * secsPerBeat;

  const durSecs = Math.max(beatsToSeconds(note.duration, bpm), 0.05);
  const { attack: a, decay: d, sustain: s, release: r } = instr;
  const v = note.velocity;
  const releaseStart = Math.max(startTime + durSecs - r, startTime + a + d);

  // --- Gain envelope ---
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(v, startTime + a);
  gain.gain.linearRampToValueAtTime(s * v, startTime + a + d);
  gain.gain.setValueAtTime(s * v, releaseStart);
  gain.gain.linearRampToValueAtTime(0, releaseStart + r);

  // Apply volume automation on top of envelope
  if (note.automation?.volumePoints) {
    for (const [beatOff, gainMul] of note.automation.volumePoints) {
      const t = startTime + beatOff * secsPerBeat;
      if (t >= startTime && t <= releaseStart + r) {
        gain.gain.setValueAtTime(gainMul * v, t);
      }
    }
  }

  // --- Panning ---
  let outputNode: AudioNode = gain;
  if (note.automation?.pan !== undefined) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, note.automation.pan));
    gain.connect(panner);
    panner.connect(destination);
    outputNode = panner;
  } else {
    gain.connect(destination);
  }

  // --- Source ---
  if (instr.type === 'sample' && instr.sample && sampleCache[instr.id]) {
    const src = ctx.createBufferSource();
    src.buffer = sampleCache[instr.id];
    const baseNote = instr.sample.baseNote ?? 48;
    const baseRate = Math.pow(2, (note.pitch - baseNote) / 12);
    src.playbackRate.value = baseRate;

    // Apply pitch automation as playbackRate changes
    if (note.automation?.pitchPoints) {
      for (const [beatOff, semShift] of note.automation.pitchPoints) {
        const t = startTime + beatOff * secsPerBeat;
        if (t >= startTime && t <= releaseStart + r) {
          src.playbackRate.setValueAtTime(baseRate * Math.pow(2, semShift / 12), t);
        }
      }
    }

    if (instr.sample.loopLength > 0) {
      src.loop = true;
      src.loopStart = instr.sample.loopStart / instr.sample.sampleRate;
      src.loopEnd = (instr.sample.loopStart + instr.sample.loopLength) / instr.sample.sampleRate;
    }
    src.connect(gain);

    // Apply sample offset (effect 9)
    const offsetFrames = note.automation?.sampleOffset ?? 0;
    const offsetSecs = offsetFrames / instr.sample.sampleRate;
    src.start(startTime, offsetSecs);
    src.stop(releaseStart + r + 0.01);
  } else {
    const osc = ctx.createOscillator();
    osc.type = instr.osc ?? 'sine';
    const baseFreq = midiToFreq(note.pitch);
    osc.frequency.value = baseFreq;

    // Apply pitch automation as frequency changes
    if (note.automation?.pitchPoints) {
      for (const [beatOff, semShift] of note.automation.pitchPoints) {
        const t = startTime + beatOff * secsPerBeat;
        if (t >= startTime && t <= releaseStart + r) {
          osc.frequency.setValueAtTime(baseFreq * Math.pow(2, semShift / 12), t);
        }
      }
    }

    osc.connect(gain);
    osc.start(startTime);
    osc.stop(releaseStart + r + 0.01);
  }

  return { gain, outputNode };
}

export function createScheduler(
  ctx: AudioContext,
  tracks: Track[],
  clips: Record<string, Clip>,
  instruments: Record<string, Instrument>,
  bpm: number,
  opts: SchedulerOptions,
): Scheduler {
  const t0 = ctx.currentTime;
  const secsPerBeat = 60 / bpm;
  const loopLength = opts.loopEnd - opts.loopStart;

  let scheduledUpTo = 0;
  let stopped = false;

  const activeSources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const activeGains: GainNode[] = [];
  const activePanners: StereoPannerNode[] = [];

  function scheduleNoteWrapped(note: Note, instr: Instrument, audioNoteStart: number) {
    const { gain, outputNode } = scheduleNote(ctx, ctx.destination, note, instr, audioNoteStart, bpm, opts.sampleCache);
    activeGains.push(gain);
    if (outputNode instanceof StereoPannerNode) activePanners.push(outputNode);
    // Collect oscillators/sources from gain's inputs (already connected in scheduleNote)
  }

  function tick() {
    if (stopped) return;

    const now = ctx.currentTime;
    const targetPlayBeat = (now - t0 + LOOKAHEAD_SEC) / secsPerBeat;

    if (!opts.loopEnabled && scheduledUpTo >= loopLength) {
      opts.onStop?.();
      return;
    }

    const activeTracks = opts.playbackMode === 'track' && opts.selectedTrackId
      ? tracks.filter(t => t.id === opts.selectedTrackId)
      : tracks.filter(t => !t.muted);

    for (const track of activeTracks) {
      const instr = instruments[track.instrumentId];
      if (!instr) continue;

      for (const pl of track.placements) {
        const clip = clips[pl.clipId];
        if (!clip) continue;

        for (const note of clip.notes) {
          const arrBeat = pl.startBeat + note.beat;

          if (arrBeat < opts.loopStart || arrBeat >= opts.loopEnd) continue;

          const base = arrBeat - opts.loopStart;

          if (opts.loopEnabled) {
            const nMin = Math.ceil((scheduledUpTo - base) / loopLength);
            const nMax = Math.floor((targetPlayBeat - base - 1e-9) / loopLength);
            for (let n = Math.max(0, nMin); n <= nMax; n++) {
              const playBeat = base + n * loopLength;
              if (playBeat >= scheduledUpTo && playBeat < targetPlayBeat) {
                scheduleNoteWrapped(note, instr, t0 + playBeat * secsPerBeat);
              }
            }
          } else {
            const playBeat = base;
            if (playBeat >= scheduledUpTo && playBeat < targetPlayBeat && playBeat < loopLength) {
              scheduleNoteWrapped(note, instr, t0 + playBeat * secsPerBeat);
            }
          }
        }
      }
    }

    scheduledUpTo = targetPlayBeat;
  }

  return {
    tick,
    stop() {
      stopped = true;
      for (const src of activeSources) {
        try { src.stop(0); } catch { /* already stopped */ }
        src.disconnect();
      }
      for (const g of activeGains) g.disconnect();
      for (const p of activePanners) p.disconnect();
    },
    getDisplayBeat() {
      const playBeat = (ctx.currentTime - t0) / secsPerBeat;
      if (opts.loopEnabled) {
        return opts.loopStart + (playBeat % loopLength);
      }
      return Math.min(opts.loopStart + playBeat, opts.loopEnd);
    },
  };
}

/** Render the song to an AudioBuffer for WAV export using OfflineAudioContext. */
export async function renderOffline(
  tracks: Track[],
  clips: Record<string, Clip>,
  instruments: Record<string, Instrument>,
  sampleCache: Record<string, AudioBuffer>,
  bpm: number,
  startBeat: number,
  endBeat: number,
): Promise<AudioBuffer> {
  const durationSecs = beatsToSeconds(endBeat - startBeat, bpm) + 2;
  const sampleRate = 44100;
  const offCtx = new OfflineAudioContext(2, Math.ceil(durationSecs * sampleRate), sampleRate);

  for (const track of tracks) {
    if (track.muted) continue;
    const instr = instruments[track.instrumentId];
    if (!instr) continue;

    for (const pl of track.placements) {
      const clip = clips[pl.clipId];
      if (!clip) continue;

      for (const note of clip.notes) {
        const arrBeat = pl.startBeat + note.beat;
        if (arrBeat < startBeat || arrBeat >= endBeat) continue;

        const audioStart = (arrBeat - startBeat) * (60 / bpm);
        scheduleNote(offCtx, offCtx.destination, note, instr, audioStart, bpm, sampleCache);
      }
    }
  }

  return offCtx.startRendering();
}

