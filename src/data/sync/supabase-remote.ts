import type { SupabaseClient } from '@supabase/supabase-js';

import type { Shoe } from '../../domain/shoe';
import type { Workout } from '../../domain/workout';
import type { Database } from './database.types';
import type { Remote, SyncRemote } from './sync-engine';
import { fromShoeRow, fromWorkoutRow, toShoeRow, toWorkoutRow } from './supabase-mapping';

// O PostgREST limita linhas por resposta; o pull pagina por server_updated_at.
const PAGE_SIZE = 1000;

type Client = SupabaseClient<Database>;
type QueryResult<R> = PromiseLike<{ data: R[] | null; error: { message: string } | null }>;

interface TableOps<T, Row> {
  upsert(records: T[]): PromiseLike<{ error: { message: string } | null }>;
  page(after: string | null): QueryResult<Row>;
  fromRow(row: Row): Remote<T>;
}

function createRemote<T, Row extends { server_updated_at: string }>(ops: TableOps<T, Row>): SyncRemote<T> {
  return {
    async push(records) {
      // O trigger do banco ignora versões mais antigas que a gravada.
      const { error } = await ops.upsert(records);
      if (error) throw new Error(error.message);
    },

    async pull(since) {
      const result: Remote<T>[] = [];
      let after = since;
      for (;;) {
        const { data, error } = await ops.page(after);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        result.push(...rows.map(ops.fromRow));
        if (rows.length < PAGE_SIZE) return result;
        after = rows[rows.length - 1].server_updated_at;
      }
    },
  };
}

export function createWorkoutsRemote(client: Client): SyncRemote<Workout> {
  return createRemote({
    upsert: (records) => client.from('workouts').upsert(records.map(toWorkoutRow), { onConflict: 'user_id,id' }),
    page: (after) => {
      const query = client.from('workouts').select('*').order('server_updated_at').limit(PAGE_SIZE);
      return after ? query.gt('server_updated_at', after) : query;
    },
    fromRow: fromWorkoutRow,
  });
}

export function createShoesRemote(client: Client): SyncRemote<Shoe> {
  return createRemote({
    upsert: (records) => client.from('shoes').upsert(records.map(toShoeRow), { onConflict: 'user_id,id' }),
    page: (after) => {
      const query = client.from('shoes').select('*').order('server_updated_at').limit(PAGE_SIZE);
      return after ? query.gt('server_updated_at', after) : query;
    },
    fromRow: fromShoeRow,
  });
}
