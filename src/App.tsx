import { useRef, useState, useEffect, useCallback } from 'react'
import './App.css'
import { useAppDispatch, useAppSelector } from './store/index'
import {
  setPlaying, loadSong,
} from './store/slice'
import { createScheduler, renderOffline } from './audio'
import type { Scheduler } from './audio'
import { encodeWAV, downloadBlob } from './wav'
import { parseMod } from './mod'
import { makeEmptyState } from './store'
import Transport from './components/Transport'
import TrackHeaders from './components/TrackHeaders'
import ArrangementGrid from './components/ArrangementGrid'
import PianoRoll from './components/PianoRoll'
import InstrumentPanel from './components/InstrumentPanel'
import type { AppState, Instrument, SampleData } from './types'

function App() {
  const dispatch = useAppDispatch()
  const song = useAppSelector(s => s.song)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [instrumentsPanelOpen, setInstrumentsPanelOpen] = useState(false)

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
    dispatch(setPlaying(false))
  }, [dispatch])

  const onPlayToggle = useCallback(async () => {
    if (song.playing) {
      stopPlayback()
      setCurrentBeat(song.loopStart)
    } else {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') await ctx.resume()
      await ensureSampleCache(song.instruments)

      const scheduler = createScheduler(ctx, song.tracks, song.clips, song.instruments, song.bpm, {
        loopEnabled: song.loopEnabled,
        loopStart: song.loopStart,
        loopEnd: song.loopEnd,
        playbackMode: song.playbackMode,
        selectedTrackId: song.selectedTrackId,
        sampleCache: sampleCacheRef.current,
        onStop: () => { stopPlayback(); setCurrentBeat(song.loopStart) },
      })
      schedulerRef.current = scheduler
      scheduler.tick()
      intervalRef.current = setInterval(() => scheduler.tick(), 100)
      const tick = () => {
        if (schedulerRef.current) setCurrentBeat(schedulerRef.current.getDisplayBeat())
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      dispatch(setPlaying(true))
    }
  }, [song, stopPlayback, ensureSampleCache, dispatch])

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
          ...song,
          instruments: Object.fromEntries(Object.entries(song.instruments).map(([k, instr]) =>
            [k, instr.type === 'sample' ? { ...instr, sample: undefined } : instr]
          )),
        }
        localStorage.setItem('tunes-song', JSON.stringify(toSave))
      } catch { /* quota */ }
    }, 800)
    return () => clearTimeout(id)
  }, [song])

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
    dispatch(loadSong(makeEmptyState()))
  }, [dispatch])

  const exportSong = useCallback(() => {
    downloadBlob(new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' }), 'song.song')
  }, [song])

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
        dispatch(loadSong(parsed as Omit<AppState, 'playing'>))
      } catch { alert('Could not load song file.') }
    }
    input.click()
  }, [dispatch])

  const importMod = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.mod'
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return
      const buf = await file.arrayBuffer()
      try {
        const parsed = parseMod(buf)
        sampleCacheRef.current = {}
        dispatch(loadSong(parsed as Omit<AppState, 'playing'>))
      } catch (e) { alert(`Could not parse MOD file: ${e}`) }
    }
    input.click()
  }, [dispatch])

  const exportWav = useCallback(async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    await ensureSampleCache(song.instruments)
    const buffer = await renderOffline(song.tracks, song.clips, song.instruments, sampleCacheRef.current, song.bpm, song.loopStart, song.loopEnd)
    downloadBlob(encodeWAV(buffer), 'song.wav')
  }, [song, ensureSampleCache])

  const loadDemo = useCallback((state: Omit<AppState, 'playing'>) => {
    if (!confirm('Load demo song? Unsaved changes will be lost.')) return
    sampleCacheRef.current = {}
    dispatch(loadSong(state))
  }, [dispatch])

  // Auto-open the instruments panel when an instrument is selected (e.g. via track header ✎)
  useEffect(() => {
    if (song.openInstrumentId) setInstrumentsPanelOpen(true)
  }, [song.openInstrumentId])

  return (
    <>
      <Transport
        currentBeat={currentBeat}
        onPlayToggle={onPlayToggle}
        onExportSong={exportSong}
        onImportSong={importSong}
        onImportMod={importMod}
        onExportWav={exportWav}
        onNewSong={newSong}
        instrumentsPanelOpen={instrumentsPanelOpen}
        onToggleInstruments={() => setInstrumentsPanelOpen(v => !v)}
        onLoadDemo={loadDemo}
      />

      <div className="flex flex-1 overflow-hidden">
        <TrackHeaders
          instrumentsPanelOpen={instrumentsPanelOpen}
          onCloseInstrumentsPanel={() => setInstrumentsPanelOpen(false)}
        />
        <ArrangementGrid currentBeat={currentBeat} />
        {instrumentsPanelOpen && (
          <InstrumentPanel onClose={() => setInstrumentsPanelOpen(false)} />
        )}
      </div>

      {song.openClipId && song.clips[song.openClipId] && (
        <PianoRoll currentBeat={currentBeat} />
      )}
    </>
  )
}

export default App
