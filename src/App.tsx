import { useReducer, useRef, useState, useEffect, useCallback } from 'react'
import './App.css'
import { reducer, makeInitialState } from './store'
import { createScheduler, renderOffline } from './audio'
import type { Scheduler } from './audio'
import { encodeWAV, downloadBlob } from './wav'
import { parseMod } from './mod'
import { makeEmptyState } from './store'
import Transport from './components/Transport'
import TrackHeaders from './components/TrackHeaders'
import ArrangementGrid from './components/ArrangementGrid'
import PianoRoll from './components/PianoRoll'
import InstrumentEditor from './components/InstrumentEditor'
import type { AppState, Instrument, SampleData } from './types'

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  const [currentBeat, setCurrentBeat] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<Scheduler | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)
  const sampleCacheRef = useRef<Record<string, AudioBuffer>>({})

  const ensureSampleCache = useCallback(async (instruments: Record<string, Instrument>) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    for (const instr of Object.values(instruments)) {
      if (instr.type !== 'sample' || !instr.sample || sampleCacheRef.current[instr.id]) continue
      const sample: SampleData = instr.sample
      const buf = ctx.createBuffer(1, Math.max(sample.pcm.length, 1), sample.sampleRate)
      const channelData = buf.getChannelData(0)
      for (let i = 0; i < sample.pcm.length; i++) channelData[i] = sample.pcm[i] / 128.0
      sampleCacheRef.current[instr.id] = buf
    }
  }, [])

  const stopPlayback = useCallback(() => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    schedulerRef.current?.stop()
    schedulerRef.current = null
    dispatch({ type: 'SET_PLAYING', playing: false })
  }, [])

  const onPlayToggle = useCallback(async () => {
    if (state.playing) {
      stopPlayback()
      setCurrentBeat(state.loopStart)
    } else {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') await ctx.resume()
      await ensureSampleCache(state.instruments)

      const scheduler = createScheduler(ctx, state.tracks, state.clips, state.instruments, state.bpm, {
        loopEnabled: state.loopEnabled,
        loopStart: state.loopStart,
        loopEnd: state.loopEnd,
        playbackMode: state.playbackMode,
        selectedTrackId: state.selectedTrackId,
        sampleCache: sampleCacheRef.current,
        onStop: () => { stopPlayback(); setCurrentBeat(state.loopStart) },
      })
      schedulerRef.current = scheduler
      scheduler.tick()
      intervalRef.current = setInterval(() => scheduler.tick(), 100)
      const tick = () => {
        if (schedulerRef.current) setCurrentBeat(schedulerRef.current.getDisplayBeat())
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      dispatch({ type: 'SET_PLAYING', playing: true })
    }
  }, [state, stopPlayback, ensureSampleCache])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault(); onPlayToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onPlayToggle])

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const toSave: AppState = {
          ...state,
          instruments: Object.fromEntries(Object.entries(state.instruments).map(([k, instr]) =>
            [k, instr.type === 'sample' ? { ...instr, sample: undefined } : instr]
          )),
        }
        localStorage.setItem('tunes-song', JSON.stringify(toSave))
      } catch { /* quota */ }
    }, 800)
    return () => clearTimeout(id)
  }, [state])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      schedulerRef.current?.stop()
    }
  }, [])

  const newSong = useCallback(() => {
    if (!confirm('Start a new song? Unsaved changes will be lost.')) return
    localStorage.removeItem('tunes-song')
    sampleCacheRef.current = {}
    dispatch({ type: 'LOAD_SONG', state: makeEmptyState() })
  }, [])

  const exportSong = useCallback(() => {
    downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'song.song')
  }, [state])

  const importSong = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.song,.json'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      const text = await file.text()
      try {
        const parsed = JSON.parse(text) as AppState
        if (!parsed.tracks || !parsed.clips) throw new Error('invalid')
        sampleCacheRef.current = {}
        dispatch({ type: 'LOAD_SONG', state: { ...parsed, playing: false } as Omit<AppState, 'playing'> })
      } catch { alert('Could not load song file.') }
    }
    input.click()
  }, [])

  const importMod = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.mod'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      const buf = await file.arrayBuffer()
      try {
        const parsed = parseMod(buf)
        sampleCacheRef.current = {}
        dispatch({ type: 'LOAD_SONG', state: parsed as Omit<AppState, 'playing'> })
      } catch (e) { alert(`Could not parse MOD file: ${e}`) }
    }
    input.click()
  }, [])

  const exportWav = useCallback(async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    await ensureSampleCache(state.instruments)
    const buffer = await renderOffline(state.tracks, state.clips, state.instruments, sampleCacheRef.current, state.bpm, state.loopStart, state.loopEnd)
    downloadBlob(encodeWAV(buffer), 'song.wav')
  }, [state, ensureSampleCache])

  const openClip = state.openClipId ? state.clips[state.openClipId] : null

  return (
    <>
      <Transport
        bpm={state.bpm}
        playing={state.playing}
        currentBeat={currentBeat}
        playbackMode={state.playbackMode}
        loopEnabled={state.loopEnabled}
        loopStart={state.loopStart}
        loopEnd={state.loopEnd}
        dispatch={dispatch}
        onPlayToggle={onPlayToggle}
        onExportSong={exportSong}
        onImportSong={importSong}
        onImportMod={importMod}
        onExportWav={exportWav}
        onNewSong={newSong}
      />

      <div className="flex flex-1 overflow-hidden">
        <TrackHeaders tracks={state.tracks} instruments={state.instruments} selectedTrackId={state.selectedTrackId} dispatch={dispatch} />
        <ArrangementGrid
          tracks={state.tracks} clips={state.clips} openClipId={state.openClipId}
          currentBeat={currentBeat} playing={state.playing}
          loopEnabled={state.loopEnabled} loopStart={state.loopStart} loopEnd={state.loopEnd}
          dispatch={dispatch}
        />
      </div>

      {state.openInstrumentId && state.instruments[state.openInstrumentId] && (
        <InstrumentEditor instrument={state.instruments[state.openInstrumentId]} dispatch={dispatch} onClose={() => dispatch({ type: 'OPEN_INSTRUMENT', id: null })} />
      )}

      {openClip && (
        <PianoRoll clip={openClip} clipId={state.openClipId!} dispatch={dispatch} onClose={() => dispatch({ type: 'OPEN_CLIP', clipId: null })} />
      )}
    </>
  )
}

export default App
