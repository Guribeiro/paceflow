import { createWorkoutRepository } from './repositories/workout-repository';
import { storage } from './storage/mmkv';

export const workoutRepository = createWorkoutRepository(storage);
