# Code Review TODOs

Issues agreed upon by 2 or more reviewers (Sonnet, Opus, GPT-4.1).

---

## 1. `activeSources` never populated — audio source nodes leak on stop
**Agreed by: Sonnet ✅ Opus ✅ GPT-4.1 ✅**
**File:** `src/audio.ts` ~line 141–150, 204–213

`activeSources` is declared to track `OscillatorNode` / `AudioBufferSourceNode` for cleanup, but `scheduleNoteWrapped` never pushes into it — only `activeGains` and `activePanners` are collected. When `stop()` iterates `activeSources` it loops over an empty array and leaves every in-flight source node running silently.

**Impact:** Every stop/start cycle accumulates ghost Web Audio nodes consuming CPU. With long-release instruments (e.g. `strings` preset: ~4 s release), rapid stop/start can produce hundreds of orphaned nodes, causing audio glitches, rising CPU usage, and eventual browser-level resource exhaustion.

**Fix:** Return the created source node from `scheduleNote()` and push it into `activeSources` inside `scheduleNoteWrapped`. Call `.stop()` on each source in the `stop()` cleanup loop.

---

## 2. `AudioContext` never closed — hits browser per-origin limit
**Agreed by: Opus ✅ GPT-4.1 ✅**
**File:** `src/App.tsx` ~line 57, 159

`AudioContext` instances are created on first play and inside `renderOffline`, but `.close()` is never called. Browsers enforce a hard limit of ~6–8 concurrent `AudioContext` instances per origin. After several WAV exports or repeated page interactions users will hit this limit and receive errors.

**Impact:** In longer sessions (especially with repeated WAV exports that each create an `OfflineAudioContext`), further audio playback or export will silently fail or throw.

**Fix:** Call `audioCtxRef.current?.close()` in the `useEffect` cleanup (and set the ref to `null`). For `renderOffline`, call `.close()` on the `OfflineAudioContext` after rendering completes.

---

## 3. Stop/play race condition — reentrant `stopPlayback` and stale `onStop` closure
**Agreed by: Opus ✅ GPT-4.1 ✅**
**File:** `src/App.tsx` ~line 44–70

Two related problems:

1. **Reentrant stop:** `stopPlayback()` calls `schedulerRef.current?.stop()`, which fires the `onStop` callback, which calls `stopPlayback()` again before the first call finishes. The interval and RAF refs may be cleared a second time while already null, and the scheduler ref is read as non-null in the inner call.

2. **Stale `loopStart` closure:** The `onStop` callback captures `song.loopStart` at the time the scheduler is created (play-start). If the user moves the loop start marker during playback, `setCurrentBeat` resets to the old value on stop.

**Impact:** Rapid play/stop toggling can leave the interval or RAF handler registered (double-start), causing the beat counter to advance at 2× speed or fire after stop. Stale `loopStart` means the playhead snaps to the wrong position on stop.

**Fix:** Guard `stopPlayback` with a flag (e.g. `isStoppingRef`) to prevent reentrance. Capture `loopStart` via a ref updated on every Redux state change so the `onStop` closure always reads the current value.

---

## Needs More Investigation

> ⚠️ The following issues were flagged by only one of the three reviewers. They may be real bugs or false positives — verify against the actual code before acting on them.

---

### A. `URL.revokeObjectURL` called synchronously after `a.click()` — download fails in Firefox
**Flagged by: Sonnet**
**File:** `src/wav.ts` ~line 49–55 (also `src/App.tsx` song export)

`URL.revokeObjectURL(url)` is called immediately after `a.click()`. Firefox schedules the download asynchronously, so the URL is revoked before Firefox fetches it, resulting in a silent failure (0-byte file or no download dialog). Fix: revoke inside a `setTimeout(..., 100)`.

---

### B. `removeTrack` / `removePlacement` orphan clips in `state.clips`
**Flagged by: Sonnet**
**File:** `src/store/slice.ts` ~line 60–88

Neither action deletes the associated `Clip` from `state.clips`. Orphaned clips accumulate indefinitely in localStorage. Additionally, chord tracks whose source track is deleted silently stop regenerating (the `if (!sourceTrack) return` guard in `regenerateChordClips` no-ops) with no user feedback.

---

### C. Division by zero when `loopStart === loopEnd`
**Flagged by: Opus**
**File:** `src/audio.ts` ~line 136, 218

If the user sets loop start and end to the same beat, `loopLength` becomes `0`. The expression `playBeat % loopLength` produces `NaN`, breaking playback entirely.

---

### D. Volume automation `setValueAtTime` overwrites ADSR envelope
**Flagged by: Opus**
**File:** `src/audio.ts` ~line 51–58

MOD volume automation uses `setValueAtTime` with absolute gain values, replacing the scheduled ADSR ramps rather than modulating on top of them. This causes clicks/pops and a broken release phase for MOD-imported notes with volume effects.

---

### E. Imported `.song` file not validated beyond `tracks`/`clips` presence
**Flagged by: Opus**
**File:** `src/App.tsx` ~line 133–138

On import, only `parsed.tracks` and `parsed.clips` are checked. Missing `instruments`, `bpm`, `loopStart`, or `loopEnd` fields in a malformed or older-format file will cause runtime crashes during playback.

---

### F. Sample loop end may exceed buffer duration
**Flagged by: GPT-4.1**
**File:** `src/audio.ts` ~line 93

`loopEnd` is set to `(loopStart + loopLength) / sampleRate` without clamping to `buffer.duration`. If `loopStart + loopLength > pcm.length`, the Web Audio API receives an out-of-range loop point and may clamp silently or produce unexpected behaviour. Fix: clamp to `Math.min(..., buffer.duration)`.

---

### G. Unsafe MOD pattern index — malformed file causes crash
**Flagged by: GPT-4.1**
**File:** `src/mod.ts` ~line 679–684

`mod.patternOrder[pos]` is used directly to index `mod.patterns[pat]` without bounds checking. A malformed MOD file with an out-of-range pattern index causes an unguarded runtime crash.

---

### H. Near-zero period in MOD parser produces `-Infinity` MIDI note
**Flagged by: GPT-4.1**
**File:** `src/mod.ts` ~line 298–301

The `period === 0` guard doesn't cover extremely small positive values. `Math.log2(nearZero / 214)` returns `-Infinity`, which propagates as a MIDI note number and can crash downstream array accesses.

---

### I. Unbounded `sampleCacheRef` growth during normal editing
**Flagged by: GPT-4.1**
**File:** `src/App.tsx` ~line 29–42

`sampleCacheRef` entries are only cleared on full state replacement (new song / import). Deleting or replacing individual `sample`-type instruments during a session never removes their cached `AudioBuffer`, leading to unbounded memory growth in long sessions with many sample instruments.

---

### J. Waveform display divides by zero for a sample with empty PCM
**Flagged by: Opus**
**File:** `src/components/InstrumentEditor.tsx` ~line 152–156

If `sample.pcm.length === 0`, the loop marker `x` calculation divides by zero, producing `NaN` SVG attributes and a broken waveform display.

---

### K. Piano roll note selection persists when switching clips
**Flagged by: Opus**
**File:** `src/components/PianoRoll.tsx` ~line 62

`selectedNoteIds` is local state that is not reset when `openClipId` changes. After switching clips, the selection badge shows a stale count and any batch operations act on stale IDs (harmlessly filtered out, but confusing UX).
