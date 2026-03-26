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

  let scheduledUpTo = 0; // play-beats (monotonically increasing from 0)
  let stopped = false;

  const activeSources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const activeGains: GainNode[] = [];

  function scheduleNote(note: Note, instr: Instrument, audioStartTime: number) {
    const durSecs = Math.max(beatsToSeconds(note.duration, bpm), 0.05);
    const { attack: a, decay: d, sustain: s, release: r } = instr;
    const v = note.velocity;
    const releaseStart = Math.max(audioStartTime + durSecs - r, audioStartTime + a + d);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, audioStartTime);
    gain.gain.linearRampToValueAtTime(v, audioStartTime + a);
    gain.gain.linearRampToValueAtTime(s * v, audioStartTime + a + d);
    gain.gain.setValueAtTime(s * v, releaseStart);
    gain.gain.linearRampToValueAtTime(0, releaseStart + r);
    gain.connect(ctx.destination);
    activeGains.push(gain);

    if (instr.type === 'sample' && instr.sample && opts.sampleCache[instr.id]) {
      const src = ctx.createBufferSource();
      src.buffer = opts.sampleCache[instr.id];
      const baseNote = instr.sample.baseNote ?? 48;
      src.playbackRate.value = Math.pow(2, (note.pitch - baseNote) / 12);
      if (instr.sample.loopLength > 0) {
        src.loop = true;
        src.loopStart = instr.sample.loopStart / instr.sample.sampleRate;
        src.loopEnd = (instr.sample.loopStart + instr.sample.loopLength) / instr.sample.sampleRate;
      }
      src.connect(gain);
      src.start(audioStartTime);
      src.stop(releaseStart + r + 0.01);
      activeSources.push(src);
    } else {
      const osc = ctx.createOscillator();
      osc.type = instr.osc ?? 'sine';
      osc.frequency.value = midiToFreq(note.pitch);
      osc.connect(gain);
      osc.start(audioStartTime);
      osc.stop(releaseStart + r + 0.01);
      activeSources.push(osc);
    }
  }

  function tick() {
    if (stopped) return;

    const now = ctx.currentTime;
    const targetPlayBeat = (now - t0 + LOOKAHEAD_SEC) / secsPerBeat;

    // Non-looping: stop scheduling once past the loop range
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
          const arrBeat = pl.startBeat + note.beat; // arrangement beat

          // Only consider notes within the loop range
          if (arrBeat < opts.loopStart || arrBeat >= opts.loopEnd) continue;

          // play-beat offset of this note within the loop
          const base = arrBeat - opts.loopStart;

          if (opts.loopEnabled) {
            // Find all loop iterations where this note falls in [scheduledUpTo, targetPlayBeat)
            const nMin = Math.ceil((scheduledUpTo - base) / loopLength);
            const nMax = Math.floor((targetPlayBeat - base - 1e-9) / loopLength);
            for (let n = Math.max(0, nMin); n <= nMax; n++) {
              const playBeat = base + n * loopLength;
              if (playBeat >= scheduledUpTo && playBeat < targetPlayBeat) {
                scheduleNote(note, instr, t0 + playBeat * secsPerBeat);
              }
            }
          } else {
            const playBeat = base;
            if (playBeat >= scheduledUpTo && playBeat < targetPlayBeat && playBeat < loopLength) {
              scheduleNote(note, instr, t0 + playBeat * secsPerBeat);
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
  const durationSecs = beatsToSeconds(endBeat - startBeat, bpm) + 2; // +2s tail for release
  const sampleRate = 44100;
  const offCtx = new OfflineAudioContext(2, Math.ceil(durationSecs * sampleRate), sampleRate);
  const t0 = offCtx.currentTime;
  const secsPerBeat = 60 / bpm;

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

        const audioStart = t0 + (arrBeat - startBeat) * secsPerBeat;
        const durSecs = Math.max(beatsToSeconds(note.duration, bpm), 0.05);
        const { attack: a, decay: d, sustain: s, release: r } = instr;
        const v = note.velocity;
        const releaseStart = Math.max(audioStart + durSecs - r, audioStart + a + d);

        const gain = offCtx.createGain();
        gain.gain.setValueAtTime(0, audioStart);
        gain.gain.linearRampToValueAtTime(v, audioStart + a);
        gain.gain.linearRampToValueAtTime(s * v, audioStart + a + d);
        gain.gain.setValueAtTime(s * v, releaseStart);
        gain.gain.linearRampToValueAtTime(0, releaseStart + r);
        gain.connect(offCtx.destination);

        if (instr.type === 'sample' && instr.sample && sampleCache[instr.id]) {
          const src = offCtx.createBufferSource();
          src.buffer = sampleCache[instr.id];
          const baseNote = instr.sample.baseNote ?? 48;
          src.playbackRate.value = Math.pow(2, (note.pitch - baseNote) / 12);
          if (instr.sample.loopLength > 0) {
            src.loop = true;
            src.loopStart = instr.sample.loopStart / instr.sample.sampleRate;
            src.loopEnd = (instr.sample.loopStart + instr.sample.loopLength) / instr.sample.sampleRate;
          }
          src.connect(gain);
          src.start(audioStart);
          src.stop(releaseStart + r + 0.01);
        } else {
          const osc = offCtx.createOscillator();
          osc.type = instr.osc ?? 'sine';
          osc.frequency.value = midiToFreq(note.pitch);
          osc.connect(gain);
          osc.start(audioStart);
          osc.stop(releaseStart + r + 0.01);
        }
      }
    }
  }

  return offCtx.startRendering();
}

