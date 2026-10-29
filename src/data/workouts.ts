import { createWorkoutRepository } from './repositories/workout-repository';
import { storage } from './storage/mmkv';
import { syncState } from './sync';

export const workoutRepository = createWorkoutRepository(storage, {
  // Toda alteração local entra na fila do sync, mesmo sem conta: ao entrar,
  // a primeira sincronização sobe o histórico inteiro de qualquer forma.
  onLocalChange: (ids) => syncState.markDirty(ids),
});
