# Saving & Exporting

---

## Auto-Save

Your song is automatically saved in the browser every time you make a change — nothing to click. If you close the tab and reopen it, your work will be exactly as you left it.

> **Note:** Sample audio data (from MOD imports) is not saved in the browser because it's too large. The notes and arrangement are saved, but the samples themselves will be silent on next load. Re-import the MOD file to restore the sound, then export to `.song` to keep everything together.

---

## Exporting a .song File

Click **Export** in the transport bar. Tunes downloads your full project as `song.song` — a JSON file containing all tracks, clips, notes, instrument settings, and sample data.

Use `.song` files to:
- Back up your work
- Share a project with someone else
- Move your song between devices

---

## Importing a .song File

Click **Import** and select a `.song` or `.json` file. This replaces your current song with the loaded one.

---

## Exporting as WAV

Click **WAV** in the transport bar. Tunes renders the song offline and downloads `song.wav` — a stereo audio file.

**The WAV always covers the loop region** (from the loop start beat to the loop end beat), so set your loop range first:

1. Enable the **loop** button (↻) in the transport.
2. Set **from** and **to** to the beats you want — for example, from `0` to `128` for all 32 bars.
3. Click **WAV**.

> **Tip:** 4 beats = 1 bar. To export bars 1–8, set from `0` to `32`.

---

## Importing a MOD File

MOD is a classic tracker format from the Amiga era. A MOD file bundles samples and note patterns into one file.

Click **.mod** in the transport bar and select a `.mod` file. Tunes will:

1. Load all samples from the file as new instruments.
2. Convert all patterns into tracks and clips in the arrangement.

This is a great way to get sample-based sounds into Tunes, or to remix classic tracker music.

> **Tip:** Export to `.song` immediately after importing a MOD if you want to preserve the sample audio in your saved project.
