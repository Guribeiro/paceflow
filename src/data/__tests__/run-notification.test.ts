import { Platform } from 'react-native';

import {
  type RunNotificationProps,
  type RunSummaryProps,
  runNotificationProps,
  runSummaryProps,
} from '../../domain/run-notification';
import { type RunSample, type RunState, applySamples, finishRun, pauseRun, startRun } from '../../domain/run-tracker';
import type { RunNotification, RunSummaryNotification } from '../../widgets/RunNotification';
import { createRunNotificationSync } from '../run-notification';

// Em teste o Constants não tem app.json: o esquema e o pacote vêm daqui.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { scheme: 'paceflow', android: { package: 'com.gustavoribeiro.paceflow' } } },
}));

const T0 = new Date(2026, 10, 4, 10).getTime();
const METER = 1 / 111_195;

const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});

/** Corrida em andamento com `seconds` segundos a 4 m/s. */
const run = (seconds: number): RunState =>
  applySamples(
    startRun(T0, 1000),
    Array.from({ length: seconds + 1 }, (_, i) => north(i * 4, i)),
  );
const at = (seconds: number) => T0 + seconds * 1000;
/** Deixa as promessas pendentes andarem. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Fábrica falsa de notificação: só `post` e `cancelAll` são usados. */
function fakeFactory<T>() {
  return {
    post: jest.fn((_props: T, _options?: object) => Promise.resolve()),
    cancelAll: jest.fn(() => Promise.resolve()),
  };
}

function setup() {
  const run = fakeFactory<RunNotificationProps>();
  const summary = fakeFactory<RunSummaryProps>();
  const ensureChannels = jest.fn(() => Promise.resolve());
  const sync = createRunNotificationSync({
    run: run as unknown as typeof RunNotification,
    summary: summary as unknown as typeof RunSummaryNotification,
    ensureChannels,
  });
  return { run, summary, ensureChannels, sync };
}

describe('createRunNotificationSync no Android', () => {
  let platform: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  it('posta a corrida em andamento como notificação fixa que não alerta de novo', async () => {
    const { run: factory, sync, ensureChannels } = setup();
    const state = run(30);
    await sync(state, at(30));

    expect(ensureChannels).toHaveBeenCalledTimes(1);
    expect(factory.post).toHaveBeenCalledTimes(1);
    expect(factory.post).toHaveBeenCalledWith(runNotificationProps(state, at(30)), {
      id: 'run',
      channelId: 'run-live-v2',
      title: 'PaceFlow · corrida',
      text: '0:30 · 0,12 km',
      ongoing: true,
      alertOnlyOnce: true,
      url: 'paceflow://correr',
    });
  });

  it('não reposta quando nada visível mudou', async () => {
    const { run: factory, sync } = setup();
    await sync(run(30), at(30));
    await sync(run(30), at(30));
    expect(factory.post).toHaveBeenCalledTimes(1);
  });

  it('reposta quando o texto muda', async () => {
    const { run: factory, sync } = setup();
    await sync(run(30), at(30));
    await sync(run(31), at(31));
    expect(factory.post).toHaveBeenCalledTimes(2);
    expect(factory.post).toHaveBeenLastCalledWith(
      expect.objectContaining({ time: '0:31' }),
      expect.objectContaining({ id: 'run' }),
    );
  });

  it('reposta ao pausar, mesmo com os outros textos iguais', async () => {
    const { run: factory, sync } = setup();
    await sync(run(30), at(30));
    await sync(pauseRun(run(30), at(30)), at(30));
    expect(factory.post).toHaveBeenCalledTimes(2);
    expect(factory.post).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paused', pace: null }),
      expect.anything(),
    );
  });

  it('ao finalizar, troca a notificação da corrida pelo resumo, uma vez só', async () => {
    const { run: factory, summary, sync } = setup();
    await sync(run(300), at(300));
    factory.post.mockClear();
    const finished = finishRun(run(300), at(300));

    await sync(finished, at(300));
    expect(factory.cancelAll).toHaveBeenCalledTimes(1);
    expect(summary.post).toHaveBeenCalledWith(runSummaryProps(finished), {
      id: 'run',
      channelId: 'run-live-v2',
      title: 'Corrida finalizada',
      ongoing: false,
      timeoutAfter: 30 * 60 * 1000,
      url: 'paceflow://correr',
    });

    await sync(finished, at(301));
    expect(summary.post).toHaveBeenCalledTimes(1);
    expect(factory.post).not.toHaveBeenCalled();
  });

  it('cancela as duas notificações quando a corrida é descartada', async () => {
    const { run: factory, summary, sync } = setup();
    await sync(run(30), at(30));
    await sync(null, at(31));
    expect(factory.cancelAll).toHaveBeenCalledTimes(1);
    expect(summary.cancelAll).toHaveBeenCalledTimes(1);
  });

  it('não cancela nada quando não havia notificação na tela', async () => {
    const { run: factory, summary, sync, ensureChannels } = setup();
    await sync(null, at(0));
    await sync(null, at(1));
    expect(factory.cancelAll).not.toHaveBeenCalled();
    expect(summary.cancelAll).not.toHaveBeenCalled();
    expect(ensureChannels).not.toHaveBeenCalled();
  });

  it('com uma chamada em andamento, roda só a mais recente depois', async () => {
    const { run: factory, sync } = setup();
    let release!: () => void;
    factory.post.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));

    const first = sync(run(30), at(30));
    await tick(); // a primeira chamada chega ao post e fica presa nele
    expect(factory.post).toHaveBeenCalledTimes(1);

    void sync(run(60), at(60));
    void sync(run(90), at(90));
    release();
    await first;

    expect(factory.post.mock.calls.map(([props]) => props.time)).toEqual(['0:30', '1:30']);
  });

  it('engole o erro e esquece o que estava na tela, para repostar depois', async () => {
    const { run: factory, sync } = setup();
    await sync(run(30), at(30));

    factory.post.mockRejectedValueOnce(new Error('notificações desligadas'));
    await expect(sync(run(60), at(60))).resolves.toBeUndefined();

    // A notificação da tela voltou a ser a de 0:30, mas o que ela mostra é desconhecido: reposta.
    await sync(run(30), at(30));
    expect(factory.post).toHaveBeenCalledTimes(3);
  });
});

describe('createRunNotificationSync fora do Android', () => {
  it('não posta nem cria canais', async () => {
    const { run: factory, sync, ensureChannels } = setup();
    await sync(run(30), at(30));
    expect(factory.post).not.toHaveBeenCalled();
    expect(ensureChannels).not.toHaveBeenCalled();
  });
});

describe('syncRunNotification', () => {
  let platform: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => platform.restore());

  /** Módulo recarregado: os canais são criados uma vez por processo. */
  function fresh() {
    let sync!: typeof import('../run-notification').syncRunNotification;
    let notifications!: typeof import('expo-notifications');
    let widget!: typeof import('../../widgets/RunNotification');
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports -- o módulo tem de ser recarregado */
      notifications = require('expo-notifications') as typeof import('expo-notifications');
      widget = require('../../widgets/RunNotification') as typeof import('../../widgets/RunNotification');
      sync = (require('../run-notification') as typeof import('../run-notification')).syncRunNotification;
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
    jest.mocked(notifications.setNotificationChannelAsync).mockClear();
    return { sync, notifications, widget };
  }

  it('cria o canal da corrida e o do serviço de GPS uma vez só', async () => {
    const { sync, notifications } = fresh();
    const channel = jest.mocked(notifications.setNotificationChannelAsync);

    await sync(run(30), at(30));
    await sync(run(60), at(60));

    expect(channel).toHaveBeenCalledTimes(2);
    expect(channel).toHaveBeenNthCalledWith(
      1,
      'run-live-v2',
      expect.objectContaining({
        importance: notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
      }),
    );
    expect(channel).toHaveBeenNthCalledWith(
      2,
      'com.gustavoribeiro.paceflow:paceflow-run',
      expect.objectContaining({ importance: notifications.AndroidImportance.MIN }),
    );
  });

  it('tenta criar os canais de novo depois de uma falha', async () => {
    const { sync, notifications } = fresh();
    const channel = jest.mocked(notifications.setNotificationChannelAsync);
    channel.mockRejectedValueOnce(new Error('sem permissão'));

    await sync(run(30), at(30));
    expect(channel).toHaveBeenCalledTimes(1);

    await sync(run(60), at(60));
    expect(channel).toHaveBeenCalledTimes(3); // os dois canais, agora sem falha
  });

  it('posta pela notificação da corrida, com link para a aba Correr', async () => {
    const { sync, widget } = fresh();

    await sync(run(30), at(30));
    expect(jest.mocked(widget.RunNotification.post)).toHaveBeenCalledWith(
      expect.objectContaining({ time: '0:30' }),
      expect.objectContaining({ channelId: 'run-live-v2', ongoing: true, url: 'paceflow://correr' }),
    );
  });
});
