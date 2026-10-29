import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import type { RemoteWorkout, SyncRemote } from './sync-engine';
import { fromRow, toRow } from './supabase-mapping';

// O PostgREST limita linhas por resposta; o pull pagina por server_updated_at.
const PAGE_SIZE = 1000;

export function createSupabaseRemote(client: SupabaseClient<Database>): SyncRemote {
  return {
    async push(workouts) {
      // O trigger do banco ignora versões mais antigas que a gravada.
      const { error } = await client.from('workouts').upsert(workouts.map(toRow), { onConflict: 'user_id,id' });
      if (error) throw new Error(error.message);
    },

    async pull(since) {
      const result: RemoteWorkout[] = [];
      let after = since;
      for (;;) {
        let query = client.from('workouts').select('*').order('server_updated_at').limit(PAGE_SIZE);
        if (after) query = query.gt('server_updated_at', after);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        result.push(...data.map(fromRow));
        if (data.length < PAGE_SIZE) return result;
        after = data[data.length - 1].server_updated_at;
      }
    },
  };
}
