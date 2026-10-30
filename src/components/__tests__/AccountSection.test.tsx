import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import * as cloud from '../../data/cloud';
import { syncState } from '../../data/sync';
import { AccountSection, describeLastSync } from '../AccountSection';

// Getter: o import do componente lê o valor atual (prefixo "mock" exigido pelo jest.mock).
let mockCloudConfigured = true;
jest.mock('../../data/cloud', () => ({
  get isCloudConfigured() {
    return mockCloudConfigured;
  },
  sendLoginCode: jest.fn(),
  verifyLoginCode: jest.fn(),
  syncNow: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  subscribeToAccount: jest.fn(),
}));
const mocked = jest.mocked(cloud);

let emitAccount: (email: string | null) => void = () => {};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockCloudConfigured = true;
  syncState.reset();
  mocked.subscribeToAccount.mockImplementation((listener) => {
    emitAccount = listener;
    listener(null);
    return () => {};
  });
});

describe('AccountSection deslogado', () => {
  it('envia o código e confirma o login', async () => {
    mocked.sendLoginCode.mockResolvedValue({ ok: true });
    mocked.verifyLoginCode.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await render(<AccountSection />);

    const send = screen.getByRole('button', { name: 'Enviar código' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText('E-mail'), ' Eu@X.co ');
    await user.press(send);

    expect(mocked.sendLoginCode).toHaveBeenCalledWith('eu@x.co');
    expect(await screen.findByText(/Enviamos um código de 6 dígitos para eu@x.co/)).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Código'), '12a3456');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(mocked.verifyLoginCode).toHaveBeenCalledWith('eu@x.co', '123456');
  });

  it('mostra erro para código inválido', async () => {
    mocked.sendLoginCode.mockResolvedValue({ ok: true });
    mocked.verifyLoginCode.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' });
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.type(screen.getByLabelText('E-mail'), 'a@b.co');
    await user.press(screen.getByRole('button', { name: 'Enviar código' }));
    await user.type(await screen.findByLabelText('Código'), '000000');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Código inválido ou expirado.')).toBeOnTheScreen();
  });

  it('mostra erro se o envio do código falhar', async () => {
    mocked.sendLoginCode.mockResolvedValue({ ok: false, error: 'fetch failed' });
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.type(screen.getByLabelText('E-mail'), 'a@b.co');
    await user.press(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByText(/Não foi possível enviar o código/)).toBeOnTheScreen();
  });
});

describe('AccountSection conectado', () => {
  beforeEach(() => {
    mocked.subscribeToAccount.mockImplementation((listener) => {
      emitAccount = listener;
      listener('corredor@exemplo.com');
      return () => {};
    });
  });

  it('sincroniza agora e mostra o resultado', async () => {
    mocked.syncNow.mockImplementation(async () => {
      syncState.setLastSync({ at: new Date().toISOString() });
      return { ok: true, pushed: 1, pulled: 1, at: new Date().toISOString() };
    });
    const user = userEvent.setup();
    await render(<AccountSection />);

    expect(screen.getByText('Ainda não sincronizado.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Sincronizar agora' }));

    expect(mocked.syncNow).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Última sincronização: hoje às/)).toBeOnTheScreen();
  });

  it('mostra a falha da última sincronização', async () => {
    syncState.setLastSync({ at: new Date().toISOString(), error: 'Network request failed' });
    await render(<AccountSection />);
    expect(screen.getByText('A última sincronização falhou: Network request failed')).toBeOnTheScreen();
  });

  it('sai da conta e volta ao formulário', async () => {
    mocked.signOut.mockImplementation(async () => emitAccount(null));
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Sair' }));
    expect(mocked.signOut).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Enviar código' })).toBeOnTheScreen();
  });
});

describe('AccountSection excluir conta', () => {
  const DELETE_ERROR = 'Não foi possível excluir a conta. Confira a internet e tente de novo.';

  beforeEach(() => {
    mocked.subscribeToAccount.mockImplementation((listener) => {
      emitAccount = listener;
      listener('corredor@exemplo.com');
      return () => {};
    });
  });

  /** Confirma o diálogo tocando no botão destrutivo. */
  const confirmAlert = () =>
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Excluir conta')?.onPress?.();
    });

  it('pede confirmação com botão destrutivo antes de excluir', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));

    expect(alert).toHaveBeenCalledWith('Excluir conta?', expect.stringContaining('apagados'), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir conta', style: 'destructive', onPress: expect.any(Function) },
    ]);
    expect(mocked.deleteAccount).not.toHaveBeenCalled();
  });

  it('cancelar a confirmação não exclui', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));
    expect(mocked.deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeEnabled();
  });

  it('confirmar exclui a conta e volta ao formulário de login', async () => {
    confirmAlert();
    mocked.deleteAccount.mockImplementation(async () => {
      emitAccount(null);
      return { ok: true };
    });
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));

    expect(mocked.deleteAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Enviar código' })).toBeOnTheScreen();
    expect(screen.queryByText(DELETE_ERROR)).not.toBeOnTheScreen();
  });

  it('desativa os botões enquanto exclui', async () => {
    confirmAlert();
    let finish: (result: { ok: boolean }) => void = () => {};
    mocked.deleteAccount.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));

    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sincroniza/ })).toBeDisabled();

    await act(async () => finish({ ok: false }));
  });

  it('falha mostra o aviso e reativa os botões', async () => {
    confirmAlert();
    mocked.deleteAccount.mockResolvedValue({ ok: false, error: 'Network request failed' });
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));

    expect(await screen.findByText(DELETE_ERROR)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sincronizar agora' })).toBeEnabled();
    // Continua conectado.
    expect(screen.getByText(/corredor@exemplo.com/)).toBeOnTheScreen();
  });

  it('nova tentativa apaga o aviso da falha anterior', async () => {
    confirmAlert();
    mocked.deleteAccount.mockResolvedValueOnce({ ok: false, error: 'offline' });
    let finish: (result: { ok: boolean }) => void = () => {};
    mocked.deleteAccount.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await render(<AccountSection />);
    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));
    expect(await screen.findByText(DELETE_ERROR)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Excluir conta' }));
    expect(screen.queryByText(DELETE_ERROR)).not.toBeOnTheScreen();
    await act(async () => finish({ ok: true }));
  });
});

describe('describeLastSync', () => {
  const now = new Date(2026, 9, 29, 15, 0);
  it('mostra "hoje" ou a data', () => {
    expect(describeLastSync({ at: new Date(2026, 9, 29, 14, 32).toISOString() }, now)).toBe(
      'Última sincronização: hoje às 14:32.',
    );
    expect(describeLastSync({ at: new Date(2026, 9, 27, 8, 5).toISOString() }, now)).toBe(
      'Última sincronização: 27/10 às 08:05.',
    );
  });
});

it('não aparece quando o app não tem Supabase configurado', async () => {
  mockCloudConfigured = false;
  await render(<AccountSection />);
  await act(async () => {});
  expect(screen.queryByText('Conta e backup na nuvem')).not.toBeOnTheScreen();
});
