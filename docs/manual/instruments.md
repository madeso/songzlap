# Instruments

Every track has an instrument that determines what its notes sound like. All instruments are managed from the **Instruments panel** on the right side of the screen.

---

## Opening the Instruments Panel

Click the **Instruments** button in the transport bar (top right). The panel slides in as a right sidebar. Click it again, or click **×** inside the panel, to close it.

---

## The Instruments Panel

The panel has three sections:

### Instrument list

All instruments in your song are listed here. Click any row to select it — the row highlights and the **Instrument Editor** opens in the lower part of the panel.

Each row shows:
- The instrument name
- A type indicator: `Sine`, `Sqr`, `Saw`, or `Tri` for synthesizers; `smp` for samples
- A **✕** button to delete the instrument

### Creating a new instrument

Click **New** in the panel header. A blank sine synthesizer is created and immediately selected for editing. Rename it in the editor below.

### Adding from a preset

Click **Add from preset** at the bottom of the list to expand a palette of the 12 built-in sounds. Click any preset to add a copy to your instrument list. The copy is independent — you can edit it without affecting the original preset.

---

## Deleting an Instrument

Click **✕** on an instrument row. If the instrument is currently used by one or more tracks, deletion is blocked and a warning shows how many tracks are using it. Reassign those tracks to a different instrument first, then delete.

---

## Instrument Types

There are two kinds of instruments:

- **Synthesizer** — generates sound electronically from a waveform.
- **Sample** — plays back a recorded sound. Samples come from imported MOD files.

---

## Assigning an Instrument to a Track

Use the **dropdown** in the track header (in the left column). All instruments in your song appear in this list.

Clicking the **✎ (tune) icon** in the track header opens the Instruments panel with that track's instrument already selected.

---

## The Instrument Editor

When an instrument is selected in the panel, its editor appears in the lower part of the panel.

### Renaming an Instrument

Click the instrument name at the top of the editor and type a new name.

### Waveform (synthesizers only)

Four buttons select the oscillator shape:

| Button | Waveform | Sound character |
|---|---|---|
| **Sine** | Sine | Smooth, pure, soft |
| **Sqr** | Square | Hollow, buzzy, retro |
| **Saw** | Sawtooth | Bright, cutting, full |
| **Tri** | Triangle | Mellow, between sine and square |

### Waveform Preview (samples only)

Sample instruments show a graphic of the waveform. If the sample has a loop region (common in MOD files), it's highlighted in violet with green markers at the start and end. Below the graphic you'll see the sample length, duration in ms, and sample rate.

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

Tunes comes with 12 ready-to-use synth sounds, available via **Add from preset**. All copies can be edited freely.

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
