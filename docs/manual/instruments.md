# Instruments

Every track has an instrument that determines what its notes sound like. You can have as many instruments as you like and assign them freely to any track.

---

## Instrument Types

There are two kinds of instruments:

- **Synthesizer** — generates sound electronically from a waveform.
- **Sample** — plays back a recorded sound. Samples come from imported MOD files.

---

## Assigning an Instrument to a Track

Use the **dropdown** in the track header. All instruments — both synthesizers and samples — appear in this list.

---

## The Instrument Editor

Click the **✎ (tune) icon** in any track header to open the Instrument Editor. It docks above the Piano Roll at the bottom of the screen. Click **×** to close it.

---

### Renaming an Instrument

Click the instrument name at the top of the editor and type a new name.

---

### Waveform (synthesizers only)

Four buttons select the oscillator shape:

| Button | Waveform | Sound character |
|---|---|---|
| **Sine** | Sine | Smooth, pure, soft |
| **Sqr** | Square | Hollow, buzzy, retro |
| **Saw** | Sawtooth | Bright, cutting, full |
| **Tri** | Triangle | Mellow, between sine and square |

---

### Waveform Preview (samples only)

Sample instruments show a graphic of the waveform. If the sample has a loop region (common in MOD files), it's highlighted in violet with green markers at the start and end. Below the graphic you'll see the sample length, duration in ms, and sample rate.

---

### Envelope (ADSR)

The four sliders shape how the volume of each note changes over time:

| Slider | What it controls |
|---|---|
| **A — Attack** | How long it takes for the note to reach full volume. Short = instant hit. Long = slow fade in. |
| **D — Decay** | How quickly the volume falls from its peak down to the sustain level. |
| **S — Sustain** | The volume level held for the duration of the note. 100% = full volume. 0% = silent after the decay (good for plucks and bells). |
| **R — Release** | How long the note takes to fade out after it ends. Short = abrupt cut. Long = lingering tail. |

**Common envelope shapes:**

| Sound | A | D | S | R |
|---|---|---|---|---|
| Punchy bass | Short | Short | High | Short |
| Plucked string | Short | Long | Zero | Short |
| Slow pad | Long | Medium | High | Long |
| Bell | Short | Long | Zero | Medium |

---

## The Built-in Synthesizer Presets

Tunes comes with 12 ready-to-use synth sounds. All of them can be edited freely in the Instrument Editor.

| Name | Character |
|---|---|
| **Synth Lead** | Bright sawtooth — good for melodies |
| **Pad** | Soft sine with slow attack — lush background texture |
| **Bass** | Tight square wave — punchy low end |
| **Pluck** | Short triangle — picks and fades away |
| **Keys** | Piano-like decay |
| **Organ** | Continuous sine, no decay — held notes sustain fully |
| **Strings** | Slow-attack sawtooth |
| **Brass** | Medium-attack sawtooth |
| **Bell** | Long-decay sine with no sustain |
| **Sub Bass** | Deep sine — sub-frequency rumble |
| **Hard Lead** | Square wave lead — harder edge than Synth Lead |
| **Stab** | Instant attack, zero sustain — sharp rhythmic chords |
