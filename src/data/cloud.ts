import { syncState } from './sync';
import { createSyncEngine, type SyncResult } from './sync/sync-engine';
import { supabase } from './sync/supabase-client';
import { createSupabaseRemote } from './sync/supabase-remote';
import { workoutRepository } from './workouts';

/** Ponto único da conta e do backup na nuvem para a interface. */

export const isCloudConfigured = supabase !== null;

const engine = supabase
  ? createSyncEngine({ repo: workoutRepository, remote: createSupabaseRemote(supabase), state: syncState })
  : null;

export async function syncNow(): Promise<SyncResult> {
  if (!engine) return { ok: false, error: 'Sync não configurado' };
  return engine.sync();
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
