import type { Track, Clip, Instrument } from './types';
import { midiToFreq, beatsToSeconds } from './utils';

export interface PlaybackHandle {
  stop(): void;
  getBeats(): number;
}

export function startPlayback(
  ctx: AudioContext,
  tracks: Track[],
  clips: Record<string, Clip>,
  instruments: Record<string, Instrument>,
  bpm: number,
): PlaybackHandle {
  const t0 = ctx.currentTime;
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  for (const track of tracks) {
    if (track.muted) continue;
    const instr = instruments[track.instrumentId];
    if (!instr) continue;

    for (const pl of track.placements) {
      const clip = clips[pl.clipId];
      if (!clip) continue;

      for (const note of clip.notes) {
        const absBeats = pl.startBeat + note.beat;
        const startT = t0 + beatsToSeconds(absBeats, bpm);
        const durT = Math.max(beatsToSeconds(note.duration, bpm), 0.05);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = instr.osc;
        osc.frequency.value = midiToFreq(note.pitch);

        const v = note.velocity;
        const { attack: a, decay: d, sustain: s, release: r } = instr;
        const releaseStart = Math.max(startT + durT - r, startT + a + d);

        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(v, startT + a);
        gain.gain.linearRampToValueAtTime(s * v, startT + a + d);
        gain.gain.setValueAtTime(s * v, releaseStart);
        gain.gain.linearRampToValueAtTime(0, releaseStart + r);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(releaseStart + r + 0.01);

        oscs.push(osc);
        gains.push(gain);
      }
    }
  }

  return {
    stop() {
      oscs.forEach(o => { try { o.stop(0); } catch { /* already stopped */ } o.disconnect(); });
      gains.forEach(g => g.disconnect());
    },
    getBeats: () => (ctx.currentTime - t0) * (bpm / 60),
  };
}
