import { useReducer, useRef, useState, useEffect, useCallback } from 'react'
import './App.css'
import { reducer, makeInitialState } from './store'
import { startPlayback } from './audio'
import type { PlaybackHandle } from './audio'
import Transport from './components/Transport'
import TrackHeaders from './components/TrackHeaders'
import ArrangementGrid from './components/ArrangementGrid'
import PianoRoll from './components/PianoRoll'

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  const [currentBeat, setCurrentBeat] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const playbackRef = useRef<PlaybackHandle | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (playbackRef.current) {
      playbackRef.current.stop()
      playbackRef.current = null
    }
    dispatch({ type: 'SET_PLAYING', playing: false })
  }, [])

  const onPlayToggle = useCallback(() => {
    if (state.playing) {
      stopPlayback()
      setCurrentBeat(0)
    } else {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const handle = startPlayback(ctx, state.tracks, state.clips, state.bpm)
      playbackRef.current = handle
      dispatch({ type: 'SET_PLAYING', playing: true })

      const tick = () => {
        setCurrentBeat(handle.getBeats())
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [state.playing, state.tracks, state.clips, state.bpm, stopPlayback])

  // Space-bar shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault()
        onPlayToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onPlayToggle])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      playbackRef.current?.stop()
    }
  }, [])

  const openClip = state.openClipId ? state.clips[state.openClipId] : null

  return (
    <>
      <Transport
        bpm={state.bpm}
        playing={state.playing}
        currentBeat={currentBeat}
        dispatch={dispatch}
        onPlayToggle={onPlayToggle}
      />

      <div className="flex flex-1 overflow-hidden">
        <TrackHeaders tracks={state.tracks} dispatch={dispatch} />
        <ArrangementGrid
          tracks={state.tracks}
          clips={state.clips}
          openClipId={state.openClipId}
          currentBeat={currentBeat}
          playing={state.playing}
          dispatch={dispatch}
        />
      </div>

      {openClip && (
        <PianoRoll
          clip={openClip}
          clipId={state.openClipId!}
          dispatch={dispatch}
          onClose={() => dispatch({ type: 'OPEN_CLIP', clipId: null })}
        />
      )}
    </>
  )
}

export default App
