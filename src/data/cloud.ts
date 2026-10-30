import { parsePreferencesRecord } from '../domain/preferences';
import { parseShoeRecord } from '../domain/shoe';
import { preferencesRepository } from './preferences';
import { parseWorkoutRecord } from '../domain/workout';
import { shoeRepository } from './shoes';
import { prefsSyncState, shoeSyncState, syncState } from './sync';
import { createSyncEngine, type SyncResult } from './sync/sync-engine';
import { supabase } from './sync/supabase-client';
import { createPreferencesRemote, createShoesRemote, createWorkoutsRemote } from './sync/supabase-remote';
import { workoutRepository } from './workouts';

/** Ponto único da conta e do backup na nuvem para a interface. */

export const isCloudConfigured = supabase !== null;

const engines = supabase
  ? {
      preferences: createSyncEngine({
        repo: preferencesRepository,
        remote: createPreferencesRemote(supabase),
        state: prefsSyncState,
        parse: parsePreferencesRecord,
      }),
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
 * Preferências, tênis e depois treinos (os shoeId que chegam já têm dono). O
 * estado dos treinos é o que a tela de Ajustes mostra; uma falha antes dele
 * também é registrada nele.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!engines) return { ok: false, error: 'Sync não configurado' };
  let pushed = 0;
  let pulled = 0;
  for (const engine of [engines.preferences, engines.shoes]) {
    const result = await engine.sync();
    if (!result.ok) {
      syncState.setLastSync({ at: new Date().toISOString(), error: result.error });
      return result;
    }
    pushed += result.pushed;
    pulled += result.pulled;
  }
  const workouts = await engines.workouts.sync();
  return workouts.ok ? { ...workouts, pushed: workouts.pushed + pushed, pulled: workouts.pulled + pulled } : workouts;
}

/** Há alterações locais esperando envio (treinos ou tênis)? */
export function hasPendingChanges(): boolean {
  return [syncState, shoeSyncState, prefsSyncState].some((state) => state.getDirty().length > 0);
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

function resetSyncState() {
  syncState.reset();
  shoeSyncState.reset();
  prefsSyncState.reset();
}

/** Sai da conta. Os treinos continuam no aparelho; o estado do sync recomeça. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  resetSyncState();
}

/**
 * Exclui a conta e tudo dela na nuvem (exigência da Google Play). Os treinos
 * continuam no aparelho. A sessão sai só localmente: o usuário já não existe.
 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sync não configurado' };
  const { error } = await supabase.rpc('delete_own_account');
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut({ scope: 'local' });
  resetSyncState();
  return { ok: true };
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
