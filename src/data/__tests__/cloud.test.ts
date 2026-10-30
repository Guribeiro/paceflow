import { deleteAccount, signOut } from '../cloud';
import { prefsSyncState, shoeSyncState, syncState } from '../sync';

// Cliente Supabase falso na fronteira: só o que o cloud.ts usa aqui. O getter
// deixa um teste simular o app gerado sem as variáveis do Supabase (null).
const mockSupabase = {
  rpc: jest.fn(),
  auth: { signOut: jest.fn() },
};
let mockConfigured = true;
jest.mock('../sync/supabase-client', () => ({
  get supabase() {
    return mockConfigured ? mockSupabase : null;
  },
}));

const states = [syncState, shoeSyncState, prefsSyncState];

/** Deixa os três estados com algo pendente, cursor e último sync. */
function fillSyncState() {
  for (const state of states) {
    state.markDirty(['a']);
    state.setCursor('2026-10-29T10:00:00Z');
    state.setBootstrapped();
    state.setLastSync({ at: '2026-10-29T10:00:00Z' });
  }
}

const snapshot = () =>
  states.map((state) => ({
    dirty: state.getDirty(),
    cursor: state.getCursor(),
    bootstrapped: state.isBootstrapped(),
    last: state.getLastSync(),
  }));

const pristine = states.map(() => ({ dirty: [], cursor: null, bootstrapped: false, last: null }));
const filled = states.map(() => ({
  dirty: ['a'],
  cursor: '2026-10-29T10:00:00Z',
  bootstrapped: true,
  last: { at: '2026-10-29T10:00:00Z' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigured = true;
  for (const state of states) state.reset();
  mockSupabase.auth.signOut.mockResolvedValue({ error: null });
});

describe('deleteAccount', () => {
  it('exclui pela RPC, sai só neste aparelho e zera o estado do sync', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    fillSyncState();
    expect(snapshot()).toEqual(filled);

    await expect(deleteAccount()).resolves.toEqual({ ok: true });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(snapshot()).toEqual(pristine);
  });

  it('com erro na RPC devolve o erro, continua logado e mantém o sync', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    fillSyncState();

    await expect(deleteAccount()).resolves.toEqual({ ok: false, error: 'Network request failed' });

    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(filled);
  });

  it('sai da sessão só depois de a RPC responder', async () => {
    const order: string[] = [];
    mockSupabase.rpc.mockImplementation(async () => {
      order.push('rpc');
      return { data: null, error: null };
    });
    mockSupabase.auth.signOut.mockImplementation(async () => {
      order.push('signOut');
      return { error: null };
    });
    await deleteAccount();
    expect(order).toEqual(['rpc', 'signOut']);
  });
});

describe('signOut', () => {
  it('sai da conta e zera o estado do sync dos treinos, tênis e preferências', async () => {
    fillSyncState();
    await signOut();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(snapshot()).toEqual(pristine);
  });
});

describe('sem Supabase configurado', () => {
  it('deleteAccount não faz nada e devolve falha', async () => {
    mockConfigured = false;
    fillSyncState();
    await expect(deleteAccount()).resolves.toEqual({ ok: false, error: 'Sync não configurado' });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(filled);
  });
});
