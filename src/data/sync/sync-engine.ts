import type { ImportOptions, StoredRecord } from '../repositories/record-store';
import type { SyncState } from './sync-state';

/** Registro como volta do servidor, com o carimbo usado como cursor do pull. */
export type Remote<T> = T & { serverUpdatedAt: string };

/** Transporte do sync de uma coleção; a implementação real é o Supabase (supabase-remote.ts). */
export interface SyncRemote<T> {
  /** Grava ou atualiza; o servidor ignora versões mais antigas que a dele. */
  push(records: T[]): Promise<void>;
  /** Registros com serverUpdatedAt > since (todos se null), em ordem crescente. */
  pull(since: string | null): Promise<Remote<T>[]>;
}

/** O que o motor precisa de um repositório local. */
export interface SyncableRepository<T extends StoredRecord> {
  listAll(): T[];
  getRecord(id: string): T | undefined;
  importRecords(records: readonly T[], options?: ImportOptions): unknown;
}

export type SyncResult = { ok: true; pushed: number; pulled: number; at: string } | { ok: false; error: string };

export interface SyncEngine {
  sync(): Promise<SyncResult>;
}

interface Deps<T extends StoredRecord> {
  repo: SyncableRepository<T>;
  remote: SyncRemote<T>;
  state: SyncState;
  /** Valida o que vem do servidor (ex.: parseWorkoutRecord). */
  parse: (value: unknown) => T | null;
  now?: () => string;
  batchSize?: number;
  /** Margem do pull: cobre transações que gravaram fora de ordem no servidor. */
  overlapMs?: number;
}

export function createSyncEngine<T extends StoredRecord>({
  repo,
  remote,
  state,
  parse,
  now = () => new Date().toISOString(),
  batchSize = 500,
  overlapMs = 60_000,
}: Deps<T>): SyncEngine {
  let running: Promise<SyncResult> | null = null;

  async function push(): Promise<number> {
    // Primeira sincronização da conta: sobe o histórico inteiro, inclusive o
    // que foi criado antes de existir a fila.
    if (!state.isBootstrapped()) state.markDirty(repo.listAll().map((w) => w.id));

    const dirty = state.getDirty();
    const records: T[] = [];
    const missing: string[] = [];
    for (const id of dirty) {
      const record = repo.getRecord(id);
      if (record) records.push(record);
      else missing.push(id);
    }
    state.clearDirty(missing);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await remote.push(batch);
      // Só sai da fila o que não foi editado enquanto o lote estava no ar.
      const sent = batch.filter((w) => repo.getRecord(w.id)?.updatedAt === w.updatedAt).map((w) => w.id);
      state.clearDirty(sent);
    }
    return records.length;
  }

  async function pull(): Promise<number> {
    const cursor = state.getCursor();
    const since = cursor ? new Date(Date.parse(cursor) - overlapMs).toISOString() : null;
    const rows = await remote.pull(since);
    if (rows.length === 0) return 0;

    const records = rows
      .map(({ serverUpdatedAt: _cursor, ...record }) => parse(record))
      .filter((r): r is T => r !== null);
    repo.importRecords(records, { origin: 'remote' });

    const latest = rows.reduce((max, r) => (r.serverUpdatedAt > max ? r.serverUpdatedAt : max), cursor ?? '');
    if (latest) state.setCursor(latest);
    return rows.length;
  }

  async function run(): Promise<SyncResult> {
    try {
      const pushed = await push();
      const pulled = await pull();
      state.setBootstrapped();
      const at = now();
      state.setLastSync({ at });
      return { ok: true, pushed, pulled, at };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.setLastSync({ at: now(), error: message });
      return { ok: false, error: message };
    }
  }

  return {
    sync() {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
  };
}
