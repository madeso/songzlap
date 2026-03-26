# Copilot Instructions

## Project

**tunes** — a web-based Digital Audio Workstation (DAW). Users create samples via a piano roll, select instruments, and lay out tracks. Built with React 19 + TypeScript + Vite.

## Commands

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check (tsc -b) then Vite production build
npm run lint      # ESLint (TypeScript + React hooks + react-refresh rules)
npm run preview   # preview production build locally
```

There is no test runner configured.

## Architecture

State and data flow:

- **`src/types.ts`** — all shared types: `AppState`, `Track`, `Clip`, `Note`, `Placement`, `Instrument` (with `type: 'osc' | 'sample'`), `SampleData`, and the full `Action` discriminated union.
- **`src/constants.ts`** — 12 built-in `INSTRUMENTS` presets, layout constants (`TRACK_HEIGHT`, `BAR_WIDTH`, `RULER_HEIGHT`), piano roll constants (`PR_NOTE_MIN/MAX`, `PR_CELL_WIDTH`, `SUBDIV=4`).
- **`src/store.ts`** — pure reducer (`reducer`), `makeInitialState()` (reads `localStorage` first, falls back to demo song), `makeEmptyState()` (blank project). No side effects.
- **`src/utils.ts`** — `uid()`, `midiToFreq()`, `midiToName()`, `isBlackKey()`, `beatsToSeconds()`, `formatBeatTime()`.
- **`src/audio.ts`** — `createScheduler()` returns a look-ahead scheduler (100 ms tick interval, 250 ms lookahead). `renderOffline()` uses `OfflineAudioContext` for WAV export.
- **`src/wav.ts`** — `encodeWAV(AudioBuffer) → Blob` (PCM 16-bit stereo), `downloadBlob()`.
- **`src/mod.ts`** — `parseMod(ArrayBuffer)` ProTracker 4-channel MOD parser; returns a partial `AppState`.
- **`src/App.tsx`** — root component. Owns `useReducer`, `AudioContext`, the `Scheduler`, a `sampleCacheRef` (`Record<string, AudioBuffer>`), and all imperative callbacks. Passes `dispatch` and data down as props.
- **`src/components/`** — `Transport`, `TrackHeaders`, `ArrangementGrid`, `PianoRoll`, `InstrumentEditor`.

### Data model essentials

- All time values are in **beats** (quarter notes). `SUBDIV = 4` means 16th notes are the grid atom.
- `clips` is a **flat normalised map** (`Record<string, Clip>`); tracks reference clips by ID via `placements`. Multiple placements can share the same clip.
- `state.instruments` is the live source of truth — instruments are part of state, not static constants. The constants in `constants.ts` serve only as initial defaults.
- `Instrument.type === 'sample'` instruments carry raw PCM in `Instrument.sample.pcm: number[]` (8-bit signed, −128..127). Decoded `AudioBuffer`s live in `sampleCacheRef` in `App.tsx` — **not** in state. Flush `sampleCacheRef.current = {}` whenever `LOAD_SONG` is dispatched.
- Piano roll pitch range: `PR_NOTE_MIN = 36` (C2) to `PR_NOTE_MAX = 84` (C6 exclusive) — 48 notes.

### Playback engine

`createScheduler` runs a **look-ahead tick scheduler** (not pre-scheduled):
- `App.tsx` drives it with `setInterval(..., 100)` + a `requestAnimationFrame` loop for the display beat.
- Supports loop mode (`loopEnabled`, `loopStart`, `loopEnd` in state) and Song/Track playback mode.
- Do **not** revert to the old one-shot `startPlayback` pattern — it can't handle loops.

## Styling & Assets

- **Tailwind CSS** loaded via CDN in `index.html` (includes `forms` and `container-queries` plugins) — no PostCSS/Tailwind build step. Tailwind config lives in an inline `<script>` in `index.html`.
- **Fonts:** `Space Grotesk` for headings, `Inter` for body/data — both via Google Fonts.
- **Icons:** Material Symbols Outlined (Google Fonts icon font) — use the ligature syntax (`<span className="material-symbols-outlined">play_arrow</span>`), not SVG sprites.
- **Graphics:** Inline SVG only for all diagrams and visualisations — no `<canvas>`, no third-party charting libraries.

## Key Conventions

- **`import type`** is required for type-only imports (`verbatimModuleSyntax` is on). TypeScript strict mode with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`.
- Target is **ES2023**, module resolution is `bundler` — Vite handles all imports; `.tsx` extensions are allowed in import paths.
- ESLint only lints `**/*.{ts,tsx}` — plain JS files are not linted.
- **No Redux / no React Context** — state is a single `useReducer` in `App.tsx`; `dispatch` and derived data are passed as props. The `@reduxjs/toolkit` and `react-redux` packages in `package.json` are installed but unused.
- **Auto-save**: state is debounced-saved to `localStorage` key `"tunes-song"` on every change (sample PCM excluded to avoid quota issues). On fresh load `makeInitialState()` restores it.
- All SVG layout uses constants from `constants.ts` (e.g., `TRACK_HEIGHT = 48`, `BAR_WIDTH = 80`, `RULER_HEIGHT = 24`) — never hardcode these pixel values.
