import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { preferencesRepository } from '../../data/preferences';
import {
  autoPausePreference,
  discardRunSession,
  intervalPlanRepository,
  routePreference,
  runRepository,
} from '../../data/run-session';
import { workoutRepository } from '../../data/workouts';
import { DEFAULT_INTERVAL_PLAN, type IntervalPlan } from '../../domain/interval-plan';
import { type RunSample, applySamples, startRun } from '../../domain/run-tracker';
import { storage } from '../../data/storage/mmkv';
import { RunScreen } from '../RunScreen';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn(() => ({})), router: { navigate: jest.fn() } }));
jest.mock('expo-speech');

const params = jest.mocked(useLocalSearchParams);
const PLAN_KEY = 'run-interval-plan:v1';

const T0 = new Date(2026, 9, 20, 7).getTime();
const METER = 1 / 111_195;
const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});
/** Linha reta a `speed` m/s de `fromS` a `toS`; uma amostra por segundo. */
const straight = (fromS: number, toS: number, speed: number) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => north((fromS + i) * speed, fromS + i));

/** 2 × 400 m com 200 m de recuperação, sem aquecimento nem desaquecimento. */
const PLAN: IntervalPlan = {
  warmup: null,
  reps: 2,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'distance', meters: 200 },
  cooldown: null,
  targetSecondsPerKm: null,
};

/** Relógio da tela (useRunSession e os botões leem Date.now). */
let clock = T0;

// O grupo de chips não é um elemento acessível por si (só os chips): acha pelo rótulo.
const group = (name: string) => within(screen.getByLabelText(name));
const phaseTile = (label: RegExp) => screen.getByLabelText(label);

/** Aplica amostras à corrida guardada, como a tarefa do GPS, com o relógio na última. */
async function deliver(samples: RunSample[]) {
  clock = samples.at(-1)!.timestamp;
  await act(async () => runRepository.set(applySamples(runRepository.get()!, samples)));
}

beforeEach(async () => {
  clock = T0;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  preferencesRepository.setUnit('km');
  autoPausePreference.set(true);
  routePreference.set(false);
  storage.remove(PLAN_KEY);
  params.mockReturnValue({});
  await discardRunSession();
  workoutRepository.list().forEach((w) => workoutRepository.remove(w.id));
});

afterEach(async () => {
  jest.restoreAllMocks();
  await discardRunSession();
  storage.remove(PLAN_KEY);
  routePreference.set(true);
});

describe('Correr intervalado: montar o plano', () => {
  it('começa em corrida livre e mostra o plano padrão ao escolher Intervalado', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Corrida livre' })).toBeChecked();
    expect(screen.queryByText('Treino intervalado')).toBeNull();

    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));
    expect(screen.getByRole('radio', { name: 'Intervalado' })).toBeChecked();
    expect(screen.getByText('Aquecimento 10 min · 8 × 400 m (rec. 1 min) · Desaquecimento 5 min')).toBeOnTheScreen();
  });

  it('monta o treino, começa sem pausa automática e guarda o plano para a próxima', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));

    await user.press(group('Aquecimento').getByRole('radio', { name: 'Sem' }));
    await user.press(group('Tiros: 8').getByRole('radio', { name: 'Outro' }));
    await user.type(screen.getByLabelText('Quantidade de tiros'), '3');
    await user.press(group('Tiro: 400 m').getByRole('radio', { name: '800 m' }));
    await user.press(group('Recuperação').getByRole('radio', { name: 'Distância' }));
    await user.press(group('Recuperação: 100 m').getByRole('radio', { name: '200 m' }));
    await user.press(group('Desaquecimento').getByRole('radio', { name: 'Sem' }));
    await user.type(screen.getByLabelText('Pace-alvo do tiro (min/km, opcional)'), '350');

    expect(screen.getByText('3 × 800 m (rec. 200 m) · alvo 3:50/km')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    const expected: IntervalPlan = {
      warmup: null,
      reps: 3,
      work: { kind: 'distance', meters: 800 },
      recovery: { kind: 'distance', meters: 200 },
      cooldown: null,
      targetSecondsPerKm: 230,
    };
    expect(runRepository.get()).toMatchObject({ status: 'running', autoPause: false, intervals: { plan: expected, index: 0 } });
    expect(intervalPlanRepository.get()).toEqual(expected);
    expect(phaseTile(/^Tiro 1\/3: 800 metros, faltam$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pular fase' })).toBeOnTheScreen();
  });

  it('em milhas, o pace-alvo digitado por milha é guardado em s/km', async () => {
    preferencesRepository.setUnit('mi');
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));
    await user.type(screen.getByLabelText('Pace-alvo do tiro (min/mi, opcional)'), '610');

    expect(screen.getByText(/· alvo 6:10\/mi ·/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    // 6:10/mi = 370 s / 1,609344.
    expect(runRepository.get()?.intervals?.plan.targetSecondsPerKm).toBeCloseTo(370 / 1.609344, 6);
  });

  it('mostra o erro de tiros fora do limite sem mudar o plano', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));
    await user.press(group('Tiros: 8').getByRole('radio', { name: 'Outro' }));
    await user.type(screen.getByLabelText('Quantidade de tiros'), '51');

    expect(screen.getByText('De 1 a 50')).toBeOnTheScreen();
    expect(screen.getByText(/· 5 × 400 m/)).toBeOnTheScreen();
  });

  it('corrida livre começa sem plano mesmo depois de abrir o intervalado', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));
    await user.press(screen.getByRole('radio', { name: 'Corrida livre' }));
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(runRepository.get()).toMatchObject({ autoPause: true, intervals: null });
    expect(screen.queryByRole('button', { name: 'Pular fase' })).toBeNull();
  });

  it('lembra o último plano usado', async () => {
    intervalPlanRepository.set(PLAN);
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('radio', { name: 'Intervalado' }));
    expect(screen.getByText('2 × 400 m (rec. 200 m)')).toBeOnTheScreen();
    expect(group('Aquecimento').getByRole('radio', { name: 'Sem' })).toBeChecked();
  });
});

describe('Correr intervalado: em andamento', () => {
  it('a fase avança com as amostras; Pular fase leva ao fim do treino', async () => {
    runRepository.set(startRun(T0, 1000, false, false, PLAN));
    const user = userEvent.setup();
    await render(<RunScreen />);
    expect(phaseTile(/^Tiro 1\/2: 400 metros, faltam$/)).toBeOnTheScreen();

    // 3,33 m/s: 166,5 m aos 50 s.
    await deliver(straight(0, 50, 3.33));
    expect(phaseTile(/^Tiro 1\/2: 234 metros, faltam$/)).toBeOnTheScreen();

    // 432,9 m aos 130 s: o tiro fechou nos 400 m e a recuperação tem 32,9 m.
    await deliver(straight(51, 130, 3.33));
    expect(phaseTile(/^Recuperação: 168 metros, faltam$/)).toBeOnTheScreen();

    // 669,3 m aos 201 s: a recuperação fechou nos 600 m.
    await deliver(straight(131, 201, 3.33));
    expect(phaseTile(/^Tiro 2\/2: 331 metros, faltam$/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Pular fase' }));
    expect(runRepository.get()?.intervals).toMatchObject({ index: 3 });
    expect(runRepository.get()?.intervals?.results.at(-1)).toMatchObject({ kind: 'work', rep: 2, skipped: true });
    expect(screen.getByText('✓ Treino concluído. Finalize quando quiser.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pular fase' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeOnTheScreen();
  });

  it('fase por tempo mostra o restante pelo relógio', async () => {
    runRepository.set(startRun(T0, 1000, false, false, { ...PLAN, warmup: { kind: 'time', seconds: 60 } }));
    clock = T0 + 18_000;
    await render(<RunScreen />);
    expect(phaseTile(/^Aquecimento: 42 segundos, restante$/)).toBeOnTheScreen();
  });

  it('pausada, oferece Retomar e Finalizar no lugar de Pular fase', async () => {
    runRepository.set(startRun(T0, 1000, false, false, PLAN));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Pausar' }));
    expect(screen.queryByRole('button', { name: 'Pular fase' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeOnTheScreen();
  });
});

describe('Correr intervalado: finalizada', () => {
  /** Tiro 1 corrido a 3,33 m/s (2:00, 5:00/km), recuperação e tiro 2 pulado aos 201 s. */
  async function runToTheEnd(user: ReturnType<typeof userEvent.setup>) {
    await deliver(straight(0, 201, 3.33));
    await user.press(screen.getByRole('button', { name: 'Pular fase' }));
    await user.press(screen.getByRole('button', { name: 'Pausar' }));
    await user.press(screen.getByRole('button', { name: 'Finalizar' }));
  }

  it('lista os tiros e pré-preenche a nota só com os tiros concluídos', async () => {
    runRepository.set(startRun(T0, 1000, false, false, PLAN));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await runToTheEnd(user);

    expect(screen.getByRole('header', { name: 'Tiros' })).toBeOnTheScreen();
    expect(screen.getByText(/^Tiro 1: 2:00 · 400 m · 5:00\/km$/)).toBeOnTheScreen();
    expect(screen.getByText(/^Tiro 2: 0:21 · 69 m · .+\/km \(pulado\)$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota (opcional)')).toHaveDisplayValue('1×400 m · média 2:00 (5:00/km) · variação 0 s');

    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(workoutRepository.list()[0]).toMatchObject({ note: '1×400 m · média 2:00 (5:00/km) · variação 0 s' });
  });

  it('corrida livre finalizada não tem lista de tiros nem nota', async () => {
    runRepository.set(startRun(T0));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await deliver(straight(0, 100, 3));
    await user.press(screen.getByRole('button', { name: 'Pausar' }));
    await user.press(screen.getByRole('button', { name: 'Finalizar' }));

    expect(screen.queryByRole('header', { name: 'Tiros' })).toBeNull();
    expect(screen.getByLabelText('Nota (opcional)')).toHaveDisplayValue('');
  });
});

describe('Correr intervalado: vindo da calculadora', () => {
  it('pace-alvo da calculadora abre o intervalado com o alvo preenchido', async () => {
    params.mockReturnValue({ alvo: '230' });
    await render(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Intervalado' })).toBeChecked();
    expect(screen.getByText('Aquecimento 10 min · 8 × 400 m (rec. 1 min) · alvo 3:50/km · Desaquecimento 5 min')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace-alvo do tiro (min/km, opcional)')).toHaveDisplayValue('3:50');
  });

  it('em milhas, o alvo da calculadora (s/km) aparece por milha', async () => {
    preferencesRepository.setUnit('mi');
    params.mockReturnValue({ alvo: '230' });
    await render(<RunScreen />);
    // 230 s/km × 1,609344 = 370 s = 6:10/mi.
    expect(screen.getByLabelText('Pace-alvo do tiro (min/mi, opcional)')).toHaveDisplayValue('6:10');
    expect(screen.getByText(/· alvo 6:10\/mi ·/)).toBeOnTheScreen();
  });

  it('distância do tiro e alvo sobre o último plano; valores inválidos são ignorados', async () => {
    intervalPlanRepository.set(PLAN);
    params.mockReturnValue({ rep: '800', alvo: '240' });
    await render(<RunScreen />);
    expect(screen.getByText('2 × 800 m (rec. 200 m) · alvo 4:00/km')).toBeOnTheScreen();
    await screen.unmount();

    params.mockReturnValue({ rep: '20', alvo: '-5' });
    await render(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Intervalado' })).toBeChecked();
    expect(screen.getByText('2 × 400 m (rec. 200 m)')).toBeOnTheScreen();
  });

  it('com a aba já montada, um treino novo da calculadora troca o modo e o plano', async () => {
    await render(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Corrida livre' })).toBeChecked();

    params.mockReturnValue({ alvo: '240' });
    await screen.rerender(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Intervalado' })).toBeChecked();
    expect(screen.getByLabelText('Pace-alvo do tiro (min/km, opcional)')).toHaveDisplayValue('4:00');
    expect(screen.getByText(/alvo 4:00\/km/)).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(runRepository.get()?.intervals?.plan).toEqual({ ...DEFAULT_INTERVAL_PLAN, targetSecondsPerKm: 240 });
  });

  it('o mesmo pace mandado de novo pela calculadora reabre o intervalado', async () => {
    params.mockReturnValue({ alvo: '240', envio: '1' });
    await render(<RunScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'Corrida livre' }));
    expect(screen.getByRole('radio', { name: 'Corrida livre' })).toBeChecked();

    params.mockReturnValue({ alvo: '240', envio: '2' });
    await screen.rerender(<RunScreen />);
    expect(screen.getByRole('radio', { name: 'Intervalado' })).toBeChecked();
  });
});
