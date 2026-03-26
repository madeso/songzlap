# The .song format

A `.song` file is a plain JSON snapshot of the application state. It is created by **Export Song** in the transport bar and loaded by **Import Song**. The same structure is also persisted to `localStorage` under the key `tunes-song` (with sample PCM stripped — see below).

The canonical TypeScript types live in `src/types.ts`. The sections below mirror those types with added documentation.

---

## Top-level (`AppState`)

`playing` is **never written** to disk — it is always forced to `false` on load.
`openClipId` and `openInstrumentId` are UI-only and ignored on import.

```typescript
interface SongFile {
  bpm: number;

  /** "song" plays the full arrangement; "track" plays only selectedTrackId on loop */
  playbackMode: 'song' | 'track';
  selectedTrackId: string | null;

  loopEnabled: boolean;
  loopStart: number;   // beats
  loopEnd: number;     // beats

  /** UI state — written but ignored on import */
  openClipId: string | null;
  openInstrumentId: string | null;

  tracks: Track[];
  clips: Record<string, Clip>;       // keyed by Clip.id
  instruments: Record<string, Instrument>; // keyed by Instrument.id
}
```

---

## Track

```typescript
interface Track {
  id: string;
  name: string;
  instrumentId: string; // key in instruments map
  muted: boolean;
  color: string;        // CSS hex colour, e.g. "#6366f1"
  placements: Placement[];
}
```

---

## Placement

A clip placed at a position in the arrangement timeline.

```typescript
interface Placement {
  id: string;
  clipId: string;    // key in clips map
  startBeat: number; // beat offset from song start
}
```

---

## Clip

```typescript
interface Clip {
  id: string;
  lengthBeats: number;
  notes: Note[];
}
```

---

## Note

All timing is in **beats** (quarter-notes at the song BPM).

```typescript
interface Note {
  id: string;
  pitch: number;    // MIDI note number — 60 = C4, 69 = A4
  beat: number;     // start offset within the clip (0-indexed)
  duration: number; // length in beats — 0.25 = 1/16th, 0.5 = 1/8th, 1 = quarter, 2 = half, 4 = whole
  velocity: number; // 0–1
}
```

---

## Instrument

### Oscillator instrument

```typescript
interface OscInstrument {
  id: string;
  name: string;
  type: 'osc';
  osc: 'sine' | 'square' | 'sawtooth' | 'triangle';
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // 0–1 (amplitude level)
  release: number; // seconds
  sample?: never;
}
```

### Sample instrument

Same ADSR fields as above. `osc` is present for round-trip safety but unused during playback.

```typescript
interface SampleInstrument {
  id: string;
  name: string;
  type: 'sample';
  osc: OscillatorType; // kept for schema consistency; ignored during playback
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  sample: SampleData;
}

interface SampleData {
  pcm: number[];      // 8-bit signed integers, −128..127
  sampleRate: number; // Hz — standard Amiga C-3 rate is 8363
  loopStart: number;  // frame index; ignored when loopLength === 0
  loopLength: number; // frames; 0 = one-shot (no loop)
  finetune: number;   // −8..7 (ProTracker finetune)
  baseNote: number;   // MIDI note for unshifted playback — 48 = C-3
}
```

Pitch shifting at playback: `playbackRate = 2 ^ ((midiNote − baseNote) / 12)`.

---

## localStorage auto-save

The app debounces saves to `localStorage` after every state change. Before saving, the `sample.pcm` array is stripped from every sample instrument to stay within browser storage quotas. The PCM data must therefore be re-imported via a `.mod` or `.song` file that still carries it; it is never reconstructed automatically.

---

## Round-trip guarantees

| Field | Exported | Re-imported |
|---|---|---|
| `bpm`, `tracks`, `clips`, `instruments` | ✅ | ✅ |
| `loopEnabled`, `loopStart`, `loopEnd` | ✅ | ✅ |
| `playbackMode`, `selectedTrackId` | ✅ | ✅ |
| `openClipId`, `openInstrumentId` | ✅ | ignored (reset to `null`) |
| `playing` | ✗ not written | forced to `false` |
| `sample.pcm` | ✅ in `.song` | ✅ (PCM restored) |
| `sample.pcm` | ✗ stripped in localStorage | ✗ lost until re-imported |
