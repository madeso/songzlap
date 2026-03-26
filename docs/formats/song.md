# The .song format

A `.song` file is a plain JSON snapshot of the application state. It is created by **Export Song** in the transport bar and loaded by **Import Song**. The same structure is also persisted to `localStorage` under the key `tunes-song` (with sample PCM stripped — see below).

---

## Top-level object

```jsonc
{
  "bpm": 120,
  "playbackMode": "song",        // "song" | "track"
  "selectedTrackId": null,       // string | null
  "loopEnabled": false,
  "loopStart": 0,                // beats
  "loopEnd": 32,                 // beats
  "openClipId": null,            // string | null  (UI state — ignored on import)
  "openInstrumentId": null,      // string | null  (UI state — ignored on import)
  "tracks": [ ...Track ],
  "clips": { "<clipId>": ...Clip },
  "instruments": { "<instrumentId>": ...Instrument }
}
```

`playing` is **never written** — it is always set to `false` on load.

---

## Track

```jsonc
{
  "id": "abc123",
  "name": "Melody",
  "instrumentId": "lead",        // key in the instruments map
  "muted": false,
  "color": "#6366f1",
  "placements": [ ...Placement ]
}
```

---

## Placement

A clip placed at a position in the arrangement timeline.

```jsonc
{
  "id": "def456",
  "clipId": "ghi789",            // key in the clips map
  "startBeat": 0                 // beat offset from song start
}
```

---

## Clip

```jsonc
{
  "id": "ghi789",
  "lengthBeats": 8,
  "notes": [ ...Note ]
}
```

---

## Note

All timing is in **beats** (quarter-notes at the song BPM).

```jsonc
{
  "id": "jkl012",
  "pitch": 60,        // MIDI note number (60 = C4, 69 = A4)
  "beat": 0,          // start offset within the clip (0-indexed)
  "duration": 0.5,    // length in beats (0.25 = 1/16th, 0.5 = 1/8th, 1 = quarter, …)
  "velocity": 0.8     // 0–1
}
```

---

## Instrument

### Oscillator instrument (`type: "osc"`)

```jsonc
{
  "id": "lead",
  "name": "Lead",
  "type": "osc",
  "osc": "sawtooth",   // "sine" | "square" | "sawtooth" | "triangle"
  "attack":  0.01,     // seconds
  "decay":   0.1,      // seconds
  "sustain": 0.7,      // 0–1 (level)
  "release": 0.3       // seconds
}
```

### Sample instrument (`type: "sample"`)

Same ADSR fields as above, plus a `sample` object:

```jsonc
{
  "id": "snare",
  "name": "Snare",
  "type": "sample",
  "osc": "sine",       // unused for sample instruments, kept for round-trip safety
  "attack": 0, "decay": 0, "sustain": 1, "release": 0.1,
  "sample": {
    "pcm": [ 0, 12, -8, … ],  // 8-bit signed integers (−128..127)
    "sampleRate": 8363,        // Hz — 8363 is the Amiga C-3 standard used by MOD files
    "loopStart": 0,            // frame index (0 = no loop when loopLength is also 0)
    "loopLength": 0,           // frames; 0 means one-shot (no loop)
    "finetune": 0,             // −8..7 (Amiga ProTracker finetune)
    "baseNote": 48             // MIDI note for unshifted playback (48 = C-3)
  }
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
