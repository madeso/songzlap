# Tunes — User Manual

Tunes is a browser-based music production app. You build songs by arranging clips on a timeline, drawing notes in a piano roll, and shaping sounds with a simple synthesizer. No installation, no plug-ins — just open the page and start making music.

---

## The Layout

The screen is divided into four areas stacked top to bottom:

```
┌──────────────────────────────────────┐
│  Transport (playback controls, BPM)  │
├──────────────────────────────────────┤
│  Track headers  │  Arrangement grid  │
│  (names, mute)  │  (clips on a       │
│                 │   32-bar timeline) │
├──────────────────────────────────────┤
│  Instrument Editor  (when open)      │
├──────────────────────────────────────┤
│  Piano Roll         (when open)      │
└──────────────────────────────────────┘
```

The Instrument Editor and Piano Roll open when you need them and close when you're done. Both can be open at the same time.

---

## Transport — Playback & Song Controls

The transport bar runs across the top of the screen.

### Playing and stopping

- Press the **play button** (▶) to start playback. It turns into a stop button (■) while playing.
- Press **stop** to stop. The playhead jumps back to the loop start point.
- You can also press **Spacebar** anywhere on the page (except when typing in a text field) to toggle play/stop.

The beat counter to the right of the play button shows your current position as you play.

### Tempo

Type a number into the **BPM** field to set the tempo. The range is 40–240 BPM.

### Playback modes

The **Song / Track** buttons switch between two modes:

- **Song** — all tracks play together.
- **Track** — only the highlighted track plays. Click a track name in the list on the left to select it.

### Looping

Click the **loop** button (↻) to enable looping. Two new fields appear — **from** and **to** — where you enter the loop range in beats (4 beats = 1 bar). While loop is on, playback continuously cycles between those two points.

> **Tip:** The loop region is also used when you export a WAV file — so set your loop to cover the section you want to export.

---

## Your Song is Always Saved

Tunes automatically saves your song to your browser every time you make a change. If you close the tab and come back, your work will still be there.

> **Note:** Samples loaded from a MOD file are not saved in the browser (they're too large). If you close the tab after importing a MOD, the notes and arrangement will be restored, but the samples will be silent until you import the MOD again.

---

## Starting a New Song

Click **New** in the transport bar. You'll be asked to confirm — this clears everything and starts from scratch.

---

## Building an Arrangement

The arrangement is a 32-bar timeline. Each track appears as a row, and clips (coloured blocks) represent sections of music.

### Adding tracks

Click **+ Track** in the top-left corner of the arrangement area. A new track appears with a default synthesizer sound.

Each track shows:
- Its **name** (truncated if long — hover to see the full name)
- A coloured bar on the left edge
- A dropdown to choose which **instrument** it uses
- A **✎ icon** to open the Instrument Editor for that instrument
- A **mute button** (🔊 / 🔇) to silence the track
- A **✕ button** to delete the track

### Placing clips

**Left-click on an empty spot** in the arrangement grid to place a new clip. Clips always snap to bar boundaries and are 4 bars long. You can't overlap clips on the same track.

Each clip shows a miniature preview of the notes inside it.

### Opening a clip

**Left-click on an existing clip** to open it in the Piano Roll. The Piano Roll appears at the bottom of the screen.

### Removing a clip

**Right-click on a clip** to delete it. This removes the clip from the timeline (the notes inside are preserved — placing a new clip in the same spot starts fresh, but the old clip data is gone once its last placement is removed).

---

## Drawing Notes — The Piano Roll

The Piano Roll opens at the bottom of the screen when you click a clip. It shows a grid: pitch runs vertically (higher notes at the top), time runs horizontally (left to right). The clip covers a 4-bar window.

### Drawing a note

**Click and drag** to the right on an empty area of the grid. A violet preview shows the note as you drag. Release to place it. The note snaps to 16th-note increments.

If you just click without dragging, the note is placed at the last-used length.

### Removing a note

**Click on an existing note** (not the edge) to delete it.

### Resizing a note

**Hover near the right edge** of a note — the cursor changes to a resize arrow. **Click and drag** left or right to change the length. It snaps to 16th-note increments.

### Current note length

The header of the Piano Roll shows the current note length (e.g. `1/4`, `1/8`, `1/16`). This updates as you draw or resize notes, and is used as the default length for the next note you place with a single click.

### Navigating pitch

The piano keyboard on the left side labels every C and F. Scroll vertically to navigate through the octaves (the roll covers C2 to B5 — four octaves). Scroll horizontally to move through the bar.

### Closing the Piano Roll

Click **×** in the Piano Roll header.

---

## Instruments

Every track has an instrument. An instrument determines what the notes sound like.

### Instrument types

There are two kinds of instruments:

- **Synthesizer** — generates sound from a waveform. Choose from Sine, Square, Saw, or Triangle waves.
- **Sample** — plays back a recorded sound. Samples are loaded by importing a MOD file.

### Changing a track's instrument

Use the dropdown in the track header. All instruments — both synthesizers and samples — appear in this list.

### Opening the Instrument Editor

Click the **✎ (tune) icon** in the track header. The editor panel opens above the Piano Roll.

---

## The Instrument Editor

The Instrument Editor lets you shape the sound of any instrument.

### Name

Click the name at the top of the editor to rename the instrument.

### Waveform (synthesizers only)

Four buttons — **Sine**, **Sqr**, **Saw**, **Tri** — select the oscillator waveform. Each has a distinct character:

| Waveform | Sound character |
|---|---|
| Sine | Smooth, pure, soft |
| Square | Hollow, buzzy, retro |
| Sawtooth | Bright, cutting, full |
| Triangle | Mellow, midpoint between sine and square |

### Waveform preview (samples only)

Sample instruments show a waveform graphic. If the sample loops (common in MOD files), the loop region is highlighted in violet with green markers at the start and end.

### Envelope (ADSR)

The four sliders control how the volume of each note changes over time:

| Slider | What it does |
|---|---|
| **A — Attack** | How long it takes for the note to reach full volume after you "press the key". Short = instant, long = slow fade in. |
| **D — Decay** | After hitting peak volume, how quickly it falls toward the sustain level. |
| **S — Sustain** | The volume level held while the note is playing (after the decay). 100% = full volume, 0% = silent (good for plucks and bells). |
| **R — Release** | How long the note takes to fade out after it ends. Short = abrupt, long = lingering tail. |

> **Examples:**
> - A punchy bass: short attack, short decay, high sustain, short release.
> - A plucked string: short attack, long decay, zero sustain, short release.
> - A slow pad: long attack, medium decay, high sustain, long release.

### Closing the editor

Click **×** in the editor header.

---

## The Built-in Sounds

Tunes comes with 12 synthesizer presets:

| Name | Character |
|---|---|
| Synth Lead | Bright sawtooth, good for melodies |
| Pad | Soft sine, slow attack, lush background texture |
| Bass | Square wave, tight and punchy |
| Pluck | Short triangle, picks and dies away |
| Keys | Piano-like decay |
| Organ | Continuous sine, no decay |
| Strings | Slow attack sawtooth |
| Brass | Medium attack sawtooth |
| Bell | Long decay sine, no sustain |
| Sub Bass | Deep sine, sub-frequency |
| Hard Lead | Square wave lead |
| Stab | Instant attack, no sustain — rhythmic chords |

All presets can be edited freely in the Instrument Editor.

---

## Importing a MOD File

MOD files are a classic tracker format from the Amiga era. They pack a collection of samples and note patterns into a single file.

Click **.mod** in the transport bar and select a `.mod` file from your computer. Tunes will:
1. Load all the samples from the file as new instruments.
2. Convert all the patterns to tracks and clips in the arrangement.

This is a great way to bring in raw sample material or remix classic tracker music.

> **Remember:** Samples are not saved in the browser. If you want to keep them, export your song to a `.song` file right after importing.

---

## Saving & Exporting

### Auto-save
Your song is automatically saved in the browser as you work. Nothing to click.

### Export as .song
Click **Export** to download your entire song as a `.song` file. This is the full project file — it contains all your tracks, clips, notes, and instrument settings (including sample data). Use this to back up your work or share it with someone else.

### Import a .song file
Click **Import** and select a `.song` or `.json` file. This replaces your current song with the loaded one.

### Export as WAV
Click **WAV** to render your song to a stereo audio file and download it. The WAV is rendered from the **loop start to the loop end** — so set your loop region to cover exactly what you want to export before clicking.

> **Tip:** To export the whole song, set the loop start to bar 1 (beat 0) and the loop end to the last bar that has notes in it.

---

## Tips

- **Multiple instruments, one track** — Each track uses one instrument, but you can have many tracks using the same instrument. This lets you layer sounds or write different parts.
- **Mute to isolate** — Use the mute button to silence tracks while you work on others. Muted tracks are not included in WAV exports.
- **Quick auditioning** — Switch to Track mode in the transport and select a track to hear just that one part looping.
- **Spacebar to play** — Keep your hands free from the mouse while you tweak sliders — Spacebar starts and stops playback.
- **Edit the presets** — The built-in sounds are just starting points. Open any instrument and adjust the ADSR to taste.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| **Spacebar** | Play / Stop |

---

## Limitations to Know

- The arrangement is fixed at **32 bars**. There is no way to extend it.
- All new clips are **4 bars long**. Clip length cannot be changed after placement.
- There is **no undo**. Deletions (notes, clips, tracks) are immediate and permanent.
- Note **velocity** is fixed — all notes play at the same volume.
- There are no **effects** (reverb, delay, EQ, etc.) in the current version.
