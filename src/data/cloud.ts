import { parseShoeRecord } from '../domain/shoe';
import { parseWorkoutRecord } from '../domain/workout';
import { shoeRepository } from './shoes';
import { shoeSyncState, syncState } from './sync';
import { createSyncEngine, type SyncResult } from './sync/sync-engine';
import { supabase } from './sync/supabase-client';
import { createShoesRemote, createWorkoutsRemote } from './sync/supabase-remote';
import { workoutRepository } from './workouts';

/** Ponto único da conta e do backup na nuvem para a interface. */

export const isCloudConfigured = supabase !== null;

const engines = supabase
  ? {
      shoes: createSyncEngine({
        repo: shoeRepository,
        remote: createShoesRemote(supabase),
        state: shoeSyncState,
        parse: parseShoeRecord,
      }),
      workouts: createSyncEngine({
        repo: workoutRepository,
        remote: createWorkoutsRemote(supabase),
        state: syncState,
        parse: parseWorkoutRecord,
      }),
    }
  : null;

/**
 * Tênis primeiro, para que os shoeId dos treinos que chegam já tenham dono.
 * O estado dos treinos é o que a tela de Ajustes mostra; uma falha nos tênis
 * também é registrada nele.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!engines) return { ok: false, error: 'Sync não configurado' };
  const shoes = await engines.shoes.sync();
  if (!shoes.ok) {
    syncState.setLastSync({ at: new Date().toISOString(), error: shoes.error });
    return shoes;
  }
  const workouts = await engines.workouts.sync();
  return workouts.ok
    ? { ...workouts, pushed: workouts.pushed + shoes.pushed, pulled: workouts.pulled + shoes.pulled }
    : workouts;
}

/** Há alterações locais esperando envio (treinos ou tênis)? */
export function hasPendingChanges(): boolean {
  return syncState.getDirty().length > 0 || shoeSyncState.getDirty().length > 0;
}

export async function sendLoginCode(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sync não configurado' };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyLoginCode(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sync não configurado' };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Sai da conta. Os treinos continuam no aparelho; o estado do sync recomeça. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  syncState.reset();
  shoeSyncState.reset();
}

/** E-mail da sessão atual (null sem login) e aviso de mudanças. */
export function subscribeToAccount(listener: (email: string | null) => void): () => void {
  if (!supabase) {
    listener(null);
    return () => {};
  }
  void supabase.auth.getSession().then(({ data }) => listener(data.session?.user.email ?? null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user.email ?? null));
  return () => data.subscription.unsubscribe();
}
