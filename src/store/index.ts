import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import songReducer, { addNote, removeNote, resizeNote, updateNotes, transposeClip, addPlacement, removePlacement, regenerateChordTrack } from './slice';

const listenerMiddleware = createListenerMiddleware();

// Re-generate chord tracks whenever their source melody changes
const melodyChangingActions = [addNote, removeNote, resizeNote, updateNotes, transposeClip, addPlacement, removePlacement];
for (const actionCreator of melodyChangingActions) {
  listenerMiddleware.startListening({
    actionCreator,
    effect: (_action, api) => {
      const state = api.getState() as RootState;
      // Find the clip(s) affected by this action
      const payload = _action.payload as Record<string, unknown>;
      const affectedClipId: string | undefined =
        typeof payload['clipId'] === 'string' ? payload['clipId'] :
        typeof payload['trackId'] === 'string'
          ? state.song.tracks.find(t => t.id === payload['trackId'])?.placements.at(-1)?.clipId
          : undefined;

      // Find chord tracks that source from a track owning this clip
      for (const track of state.song.tracks) {
        if (!track.chordConfig) continue;
        const sourceTrack = state.song.tracks.find(t => t.id === track.chordConfig!.sourceTrackId);
        if (!sourceTrack) continue;
        const sourceOwnsClip = affectedClipId
          ? sourceTrack.placements.some(p => p.clipId === affectedClipId)
          : true; // addPlacement/removePlacement affects the track directly
        if (sourceOwnsClip) {
          api.dispatch(regenerateChordTrack(track.id));
        }
      }
    },
  });
}

export const store = configureStore({
  reducer: { song: songReducer },
  middleware: getDefault => getDefault().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
