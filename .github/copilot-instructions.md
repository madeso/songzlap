# Copilot Instructions

## Project

**tunes** — a web-based Digital Audio Workstation (DAW). Users create samples via a piano roll, select instruments, and lay out tracks. Built with React 19 + TypeScript + Vite.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check (tsc -b) then Vite production build
npm run lint      # ESLint (TypeScript + React hooks + react-refresh rules)
npm run preview   # preview production build locally
npm run test      # run tests in watch mode (vitest)
npm run test:run  # run tests once (CI mode)
npm run coverage  # run tests with coverage report
```

Run a single test file: `npx vitest run src/utils.test.ts`

Tests live in `src/**/*.test.ts`. There are no component tests — only unit tests for pure logic: `utils.test.ts`, `store/slice.test.ts`, `store.test.ts`, `wav.test.ts`. The test environment is `happy-dom` (provides `localStorage`; avoids ESM incompatibilities of jsdom v27+).

## Architecture

State and data flow:

- **`src/types.ts`** — all shared types: `AppState`, `Track`, `Clip`, `Note`, `Placement`, `Instrument` (with `type: 'osc' | 'sample'`), `SampleData`, and the full `Action` discriminated union.
- **`src/constants.ts`** — 12 built-in `INSTRUMENTS` presets, layout constants (`TRACK_HEIGHT`, `BAR_WIDTH`, `RULER_HEIGHT`), piano roll constants (`PR_NOTE_MIN/MAX`, `PR_CELL_WIDTH`, `SUBDIV=4`).
- **`src/store/slice.ts`** — RTK `createSlice` (`songSlice`) containing all 25 reducer cases and auto-generated action creators. Imports `makeInitialState` as the slice's `initialState`.
- **`src/store/index.ts`** — `configureStore`, exports `RootState`, `AppDispatch`, and typed `useAppSelector`/`useAppDispatch` hooks.
- **`src/store.ts`** — `makeInitialState()` (reads `localStorage`, falls back to demo song), `makeEmptyState()` (blank project), `buildDefaultState()`. No reducer export (moved to slice).
- **`src/utils.ts`** — `uid()`, `midiToFreq()`, `midiToName()`, `isBlackKey()`, `beatsToSeconds()`, `formatBeatTime()`.
- **`src/audio.ts`** — `createScheduler()` returns a look-ahead scheduler (100 ms tick interval, 250 ms lookahead). `renderOffline()` uses `OfflineAudioContext` for WAV export.
- **`src/wav.ts`** — `encodeWAV(AudioBuffer) → Blob` (PCM 16-bit stereo), `downloadBlob()`.
- **`src/mod.ts`** — `parseMod(ArrayBuffer)` ProTracker 4-channel MOD parser; returns a partial `AppState`.
- **`src/chords.ts`** — `generateChordNotes(melodyNotes, clipLengthBeats, ChordConfig) → Note[]`. Detects the melodic key via pitch-class weighted scoring, segments bars (splitting on large harmonic leaps), picks diatonic triads, and voices them in one of 5 styles: `block`, `bass-only`, `arpeggio-up`, `arpeggio-down`, `strum`.
- **`src/App.tsx`**— root component. Owns `useReducer`, `AudioContext`, the `Scheduler`, a `sampleCacheRef` (`Record<string, AudioBuffer>`), and all imperative callbacks. Passes `dispatch` and data down as props.
- **`src/components/`** — eight components; all use `useAppSelector`/`useAppDispatch` directly — no prop drilling for state or dispatch:
  - **`Transport`** — props: `currentBeat`, `onPlayToggle`, `onExportSong`, `onImportSong`, `onImportMod`, `onExportWav`, `onNewSong`. All state (bpm, playing, loop, etc.) read via `useAppSelector`.
  - **`TrackHeaders`** — **no props**. Wrapped in `memo()`.
  - **`ArrangementGrid`** — **one prop**: `currentBeat` (animation state, not in Redux).
  - **`PianoRoll`** — **no props**. Reads `openClipId` from store; renders `null` if clip is missing.
  - **`InstrumentEditor`** — **no props**. Reads `openInstrumentId` from store; renders `null` if instrument is missing.
  - **`InstrumentPanel`** — props: `{ onClose }`. Sidebar that lists all instruments with add/delete/preset UI and embeds `InstrumentEditor` inline for the selected instrument.
  - **`WaveformIcon`** — pure display helper; renders an inline SVG icon for an oscillator type (`sine`, `square`, `sawtooth`, `triangle`).
  - **`Logo`** — static branding component, no props.

### Data model essentials

- All time values are in **beats** (quarter notes). `SUBDIV = 4` means 16th notes are the grid atom.
- `clips` is a **flat normalised map** (`Record<string, Clip>`); tracks reference clips by ID via `placements`. Multiple placements can share the same clip.
- `state.instruments` is the live source of truth — instruments are part of state, not static constants. The constants in `constants.ts` serve only as initial defaults.
- `Instrument.type === 'sample'` instruments carry raw PCM in `Instrument.sample.pcm: number[]` (8-bit signed, −128..127). Decoded `AudioBuffer`s live in `sampleCacheRef` in `App.tsx` — **not** in state. Flush `sampleCacheRef.current = {}` in every code path that replaces state: `importSong`, `importMod`, and `newSong`.
- Piano roll pitch range: `PR_NOTE_MIN = 36` (C2) to `PR_NOTE_MAX = 84` (C6 exclusive) — 48 notes.
- `Note.automation?: NoteAutomation` carries MOD effect data (`pitchPoints`, `volumePoints`, `pan`, `sampleOffset`, `startDelayBeats`). Populated only by `parseMod`; not editable via the piano roll UI.
- **Chord tracks**: `Track.chordConfig?: ChordConfig` marks a track as auto-generated chords. The `addChordTrack` action creates a new track inserted immediately after the source track and populates its clips via `generateChordNotes`. `setChordConfig` updates config and regenerates all clips in-place (reusing existing clip IDs so `openClipId` stays valid). Chord track clips are **overwritten on every regeneration** — do not treat them as user-editable.

### Playback engine

`createScheduler` runs a **look-ahead tick scheduler** (not pre-scheduled):
- `App.tsx` calls `scheduler.tick()` once immediately on play, then drives it with `setInterval(..., 100)`. A separate `requestAnimationFrame` loop calls `scheduler.getDisplayBeat()` for smooth UI.
- `getDisplayBeat()` returns an **arrangement beat**: `loopStart + (playBeat % loopLength)` when looping, `min(loopStart + playBeat, loopEnd)` otherwise.
- Notes outside `[loopStart, loopEnd)` are never scheduled. In loop mode, the scheduler finds all loop iterations `n` where a note's play-beat falls in `[scheduledUpTo, targetPlayBeat)`.
- `playbackMode: 'track'` plays only `selectedTrackId`, ignoring mute state. `playbackMode: 'song'` plays all non-muted tracks.
- `renderOffline()` renders `loopStart`→`loopEnd` beats into an `OfflineAudioContext` at 44100 Hz, adding a 2-second tail for release tails, and returns an `AudioBuffer` ready for WAV encoding.
- Do **not** revert to the old one-shot `startPlayback` pattern — it can't handle loops.
- **BPM and loop settings are captured at play-start** — changing them while playing has no effect until stop + restart. There is no effect to re-apply them to a running scheduler.

### Reducer non-obvious behaviours

- **`ADD_TRACK`**: picks the first `type === 'osc'` instrument key for the new track's `instrumentId`.
- **`REMOVE_PLACEMENT`**: orphans the clip — it's removed from the track's placements but the `Clip` record remains in `state.clips` indefinitely. There is no garbage-collection of orphaned clips.
- **`REMOVE_TRACK`**: nulls `openClipId` if any of the removed track's placements reference the currently-open clip; also nulls `selectedTrackId` if that track was selected.
- **`SET_LOOP`**: all three fields (`enabled`, `start`, `end`) are optional — partial updates are the intended pattern (e.g. `{ type: 'SET_LOOP', enabled: true }` toggles loop without changing range).
- **`UPDATE_NOTES`**: batch-updates `beat`, `pitch`, and/or `duration` on multiple notes in one action — prefer this over repeated `RESIZE_NOTE`/`ADD_NOTE` when modifying several notes atomically.
- **`TRANSPOSE_CLIP`**: shifts every note's pitch by a signed semitone offset.
- **`ADD_CHORD_TRACK`**: inserts the new chord track immediately after the source track in the `tracks` array. Chord clips start with default config (`block`, 1-beat notes, octave 0) and are regenerated from the source clip's notes.
- **`SET_CHORD_CONFIG`**: triggers immediate `regenerateChordClips` — calling this is the only way to change the chord style/duration/octave. Clip IDs are reused to keep `openClipId` valid.
- **`REGENERATE_CHORD_TRACK`**: re-runs chord generation without changing config (use after source track notes change).

### ArrangementGrid interactions

All hit-testing is manual coordinate math (no SVG pointer-events on individual elements):
- **Left-click empty area** → snaps to bar boundary → `ADD_PLACEMENT` (skipped silently if the new clip would overlap an existing one; no user feedback).
- **Left-click existing clip** → `OPEN_CLIP`.
- **Right-click existing clip** → `REMOVE_PLACEMENT` (no confirmation).
- There is no drag-to-move or drag-to-resize for clips.

### Piano roll drag model

Three mutually exclusive drag modes encoded in `DragState`:
- **`drawing`**: mousedown on empty cell → sets `startCell`/`pitch`; mousemove extends `endCell`; mouseup commits `ADD_NOTE`. If no drag occurred (`endCell === startCell`), duration defaults to `lastDurRef.current` instead of 1 cell.
- **`resizing`**: mousedown within 8px (`RESIZE_HANDLE_PX`) of a note's right edge → mousemove adjusts `curDurCells`; mouseup commits `RESIZE_NOTE`.
- **`removing`**: mousedown on a note body (not the resize handle) → mouseup within 4px of click position commits `REMOVE_NOTE`; dragging further cancels the remove.

`dragRef` (a `useRef`) is the source of truth for drag state inside global `window` event handlers, avoiding stale closures. `dragState` (a `useState` mirror) drives re-renders. Both are kept in sync. Notes render with `pointerEvents: 'none'`; a transparent `<rect>` overlay rendered last handles all mouse events.

## Styling & Assets

- **Tailwind CSS** loaded via CDN in `index.html` (includes `forms` and `container-queries` plugins) — no PostCSS/Tailwind build step. Tailwind config lives in an inline `<script>` in `index.html`.
- **Fonts:** `Space Grotesk` for headings, `Inter` for body/data — both via Google Fonts.
- **Icons:** Material Symbols Outlined (Google Fonts icon font) — use the ligature syntax (`<span className="material-symbols-outlined">play_arrow</span>`), not SVG sprites.
- **Graphics:** Inline SVG only for all diagrams and visualisations — no `<canvas>`, no third-party charting libraries.

## Key Conventions

- **`import type`** is required for type-only imports (`verbatimModuleSyntax` is on). TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`.
- Target is **ES2023**, module resolution is `bundler` — Vite handles all imports; `.tsx` extensions are allowed in import paths.
- ESLint only lints `**/*.{ts,tsx}` — plain JS files are not linted.
- **Redux (RTK + react-redux)** — state lives in a single Redux store (`src/store/index.ts`). The slice is `src/store/slice.ts`. Always use the typed `useAppSelector`/`useAppDispatch` hooks (not the raw `useSelector`/`useDispatch`). Action creators are exported from `slice.ts` — use them instead of raw action objects.
- **`currentBeat`** is **not** in Redux — it's local `useState` in `App.tsx` driven by a `requestAnimationFrame` loop. It is passed as a prop to `Transport` and `ArrangementGrid` only.
- **`on*` callbacks** (`onPlayToggle`, file I/O) live in `App.tsx` because they involve audio refs (`AudioContext`, `Scheduler`, `sampleCacheRef`). They are passed as props to `Transport` only.
- **Auto-save**: state is debounced-saved to `localStorage` key `"tunes-song"` on every change (sample PCM excluded to avoid quota issues). On fresh load `makeInitialState()` restores it.
- All SVG layout uses constants from `constants.ts` (e.g., `TRACK_HEIGHT = 48`, `BAR_WIDTH = 80`, `RULER_HEIGHT = 24`) — never hardcode these pixel values. The slice also uses `TRACK_COLORS` (cycling array for new track colours) and `CLIP_DEFAULT_BEATS` (default clip length in beats).
- `react-router-dom` is listed as a dependency but is not imported anywhere in the source — it is unused.
