import { render, screen, userEvent } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { routeRepository } from '../../data/routes';
import { autoPausePreference, discardRunSession, routePreference, runRepository } from '../../data/run-session';
import { workoutRepository } from '../../data/workouts';
import { simplifyRoute } from '../../domain/route';
import { type RunSample, applySamples, finishRun, pauseRun, startRun } from '../../domain/run-tracker';
import { RunScreen } from '../RunScreen';

const location = jest.mocked(Location);

// No passado: com o relógio real, a corrida em andamento tem tempo positivo.
const T0 = new Date(2026, 9, 20, 7).getTime();
const METER = 1 / 111_195;
const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});
const straight = (fromS: number, toS: number, speed: number) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => north(i * speed, fromS + i));

/** 300 m a 3 m/s em 100 s: pace atual 5:33/km. */
const running = () => applySamples(startRun(T0), straight(0, 100, 3));
/** 2,4 km a 4 m/s em 10 min: duas parciais de 4:10. */
const finished = () => finishRun(applySamples(startRun(T0), straight(0, 600, 4)), T0 + 600_000);
/** Corrida finalizada com as parciais dadas (instante acumulado de cada uma, em ms). */
const withSplits = (...splits: number[]) => ({ ...finished(), splits });

const permission = (canAskAgain: boolean): Location.LocationPermissionResponse => ({
  granted: false,
  canAskAgain,
  expires: 'never',
  status: 'denied' as Location.PermissionStatus,
});

beforeEach(async () => {
  preferencesRepository.setUnit('km');
  autoPausePreference.set(true);
  routePreference.set(true);
  await discardRunSession();
  workoutRepository.list().forEach((w) => workoutRepository.remove(w.id));
  jest.clearAllMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await discardRunSession();
});

describe('Correr: parado', () => {
  it('começa a gravar em km e mostra os números da corrida', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(runRepository.get()).toMatchObject({ status: 'running', splitMeters: 1000 });
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Distância: 0,00 quilômetros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: sem leitura')).toBeOnTheScreen();
  });

  it.each([true, false])('começa com a pausa automática dos Ajustes (%s)', async (autoPause) => {
    autoPausePreference.set(autoPause);
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(runRepository.get()?.autoPause).toBe(autoPause);
  });

  it('grava parciais em milhas quando a unidade é milhas', async () => {
    preferencesRepository.setUnit('mi');
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(runRepository.get()?.splitMeters).toBeCloseTo(1609.344, 6);
  });

  it('explica a permissão negada e limpa o aviso ao conseguir começar', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(screen.getByText(/precisa da localização para medir a corrida/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Abrir configurações' })).toBeNull();
    expect(runRepository.get()).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(screen.queryByText(/precisa da localização/)).toBeNull();
    expect(runRepository.get()?.status).toBe('running');
  });

  it('com a permissão bloqueada, oferece abrir as configurações', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce(permission(false));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(screen.getByText(/A localização do PaceFlow está bloqueada/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Abrir configurações' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('avisa quando o GPS está desligado', async () => {
    location.hasServicesEnabledAsync.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(screen.getByText(/O GPS do aparelho está desligado/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Abrir configurações' })).toBeNull();
  });

  it('avisa quando o serviço de localização não inicia', async () => {
    location.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('falhou'));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    expect(screen.getByText('Não foi possível iniciar o GPS. Tente de novo.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeEnabled();
    expect(runRepository.get()).toBeNull();
  });
});

describe('Correr: em andamento', () => {
  it('mostra distância e pace atual falados, e só Pausar', async () => {
    runRepository.set(running());
    await render(<RunScreen />);

    expect(screen.getByLabelText('Distância: 0,30 quilômetros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: 5:33 por quilômetro')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Tempo: /)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Retomar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Finalizar' })).toBeNull();
  });

  it('mostra distância e pace em milhas', async () => {
    preferencesRepository.setUnit('mi');
    runRepository.set(running());
    await render(<RunScreen />);

    expect(screen.getByLabelText('Distância: 0,19 milhas')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: 8:56 por milha')).toBeOnTheScreen();
  });

  it('pausada mostra o tempo congelado, Retomar e Finalizar', async () => {
    runRepository.set(pauseRun(running(), T0 + 100_000));
    await render(<RunScreen />);

    expect(screen.getByText('⏸ Pausada')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tempo: 1 minuto e 40 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: sem leitura')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
  });

  it('pausa, retoma e finaliza pelos botões', async () => {
    runRepository.set(running());
    const user = userEvent.setup();
    await render(<RunScreen />);

    await user.press(screen.getByRole('button', { name: 'Pausar' }));
    expect(runRepository.get()?.status).toBe('paused');
    expect(screen.getByText('⏸ Pausada')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Retomar' }));
    expect(runRepository.get()?.status).toBe('running');
    expect(screen.queryByText('⏸ Pausada')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Pausar' }));
    await user.press(screen.getByRole('button', { name: 'Finalizar' }));
    expect(runRepository.get()?.status).toBe('finished');
    expect(screen.getByText('Corrida finalizada')).toBeOnTheScreen();
  });
});

describe('Correr: finalizada', () => {
  it('mostra o resumo e as parciais faladas', async () => {
    runRepository.set(finished());
    await render(<RunScreen />);

    expect(screen.getByLabelText('Distância: 2,40 quilômetros')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tempo: 10 minutos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace médio: 4:10 por quilômetro')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 1: 4 minutos e 10 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 2: 4 minutos e 10 segundos')).toBeOnTheScreen();
  });

  it('chega ao formulário com Rua escolhida e a nota vazia (as parciais não vão para a nota)', async () => {
    runRepository.set(finished());
    await render(<RunScreen />);

    expect(screen.getByRole('radio', { name: 'Rua' })).toBeChecked();
    expect(screen.getByLabelText('Nota (opcional)')).toHaveDisplayValue('');
    expect(screen.getByRole('button', { name: 'Salvar treino' })).toBeEnabled();
  });

  it('parciais em milhas na lista e salvas no treino com o tamanho de uma milha', async () => {
    preferencesRepository.setUnit('mi');
    runRepository.set(finishRun(applySamples(startRun(T0, 1609.344), straight(0, 500, 4)), T0 + 500_000));
    const user = userEvent.setup();
    await render(<RunScreen />);

    expect(screen.getByLabelText('Milha 1: 6 minutos e 42 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota (opcional)')).toHaveDisplayValue('');
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const [saved] = workoutRepository.list();
    expect(saved).toMatchObject({ splits: [402.3], splitMeters: 1609.344 });
    expect(saved).not.toHaveProperty('note');
  });

  it('arredonda as parciais salvas a décimos de segundo', async () => {
    // 4:10,04 e 4:09,96.
    runRepository.set(withSplits(250_040, 500_000));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    expect(workoutRepository.list()[0]).toMatchObject({ splits: [250, 250], splitMeters: 1000 });
  });

  it('corrida sem parcial fechada salva o treino sem parciais', async () => {
    // 900 m: nenhum quilômetro completo.
    runRepository.set(finishRun(applySamples(startRun(T0), straight(0, 300, 3)), T0 + 300_000));
    const user = userEvent.setup();
    await render(<RunScreen />);

    expect(screen.queryByText('Parciais')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const [saved] = workoutRepository.list();
    expect(workoutRepository.list()).toHaveLength(1);
    expect(saved).not.toHaveProperty('splits');
    expect(saved).not.toHaveProperty('splitMeters');
  });

  it('salva no diário, limpa a corrida e oferece uma nova', async () => {
    runRepository.set(finished());
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const [saved] = workoutRepository.list();
    expect(workoutRepository.list()).toHaveLength(1);
    expect(saved).toMatchObject({ durationSeconds: 600, terrain: 'rua', splits: [250, 250], splitMeters: 1000 });
    expect(saved).not.toHaveProperty('note');
    expect(saved.distanceMeters).toBeCloseTo(2400, 0);
    expect(runRepository.get()).toBeNull();
    expect(screen.getByText(/^✓ Corrida salva no diário/)).toBeOnTheScreen();
    expect(screen.getByText(/Semana garantida: sequência iniciada!/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova corrida' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
  });

  it('comemora o recorde ao salvar', async () => {
    // 5,005 km em 1001 s: 5 km em 16:40.
    runRepository.set(finishRun(applySamples(startRun(T0), straight(0, 1001, 5)), T0 + 1_001_000));
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    expect(screen.getByText(/Primeira marca nos 5 km: 16:40/)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Corrida salva no diário. Primeira marca nos 5 km: 16 minutos e 40 segundos. Semana garantida: sequência iniciada!',
      ),
    ).toBeOnTheScreen();
  });

  it('corrida curta demais não oferece o formulário', async () => {
    runRepository.set(finishRun(applySamples(startRun(T0), [north(0, 0), north(8, 4)]), T0 + 5000));
    await render(<RunScreen />);

    expect(screen.getByText('A corrida ficou curta demais para registrar no diário.')).toBeOnTheScreen();
    expect(screen.queryByText('Registrar no diário')).toBeNull();
    // Poucos metros de ruído davam "Pace médio: 10:22:25/mi" no A50.
    expect(screen.queryByText(/Pace médio/)).toBeNull();
  });

  it('a partir de 10 m já oferece o formulário', async () => {
    runRepository.set(finishRun(applySamples(startRun(T0), [north(0, 0), north(12, 5)]), T0 + 5000));
    await render(<RunScreen />);

    expect(screen.getByText('Registrar no diário')).toBeOnTheScreen();
    expect(screen.queryByText(/curta demais/)).toBeNull();
  });

  it('descarta a corrida depois de confirmar', async () => {
    runRepository.set(finished());
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Descartar')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Descartar corrida' }));

    expect(alert).toHaveBeenCalledWith('Descartar a corrida?', expect.any(String), expect.any(Array));
    expect(runRepository.get()).toBeNull();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeOnTheScreen();
    expect(workoutRepository.list()).toHaveLength(0);
  });

  it('mantém a corrida ao cancelar o descarte', async () => {
    runRepository.set(finished());
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancelar')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Descartar corrida' }));

    expect(runRepository.get()?.status).toBe('finished');
    expect(screen.getByText('Corrida finalizada')).toBeOnTheScreen();
  });
});

describe('Correr: parcial mais rápida', () => {
  it('destaca só a parcial mais rápida, por texto e no rótulo falado', async () => {
    // 4:10, 4:00 e 4:15.
    runRepository.set(withSplits(250_000, 490_000, 745_000));
    await render(<RunScreen />);

    expect(screen.getByLabelText('Quilômetro 2: 4 minutos, a mais rápida')).toBeOnTheScreen();
    expect(screen.getByText('2 km · mais rápida')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 1: 4 minutos e 10 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 3: 4 minutos e 15 segundos')).toBeOnTheScreen();
    expect(screen.getAllByText(/mais rápida/)).toHaveLength(1);
  });

  it('empate no segundo exibido não destaca nenhuma', async () => {
    // 4:10,4 e 4:09,6: a segunda é mais rápida por fração, mas as duas aparecem como 4:10.
    runRepository.set(withSplits(250_400, 500_000));
    await render(<RunScreen />);

    expect(screen.getAllByLabelText(/^Quilômetro \d: /)).toHaveLength(2);
    expect(screen.queryByLabelText(/a mais rápida/)).toBeNull();
    expect(screen.queryByText(/mais rápida/)).toBeNull();
  });

  it('com uma parcial só, não há destaque', async () => {
    runRepository.set(withSplits(250_000));
    await render(<RunScreen />);

    expect(screen.getByLabelText('Quilômetro 1: 4 minutos e 10 segundos')).toBeOnTheScreen();
    expect(screen.queryByText(/mais rápida/)).toBeNull();
  });
});

describe('Correr: pausa automática', () => {
  /** 120 m a 4 m/s em 30 s (pace 4:10/km), com a pausa automática ligada; parado nos 120 m dos 31 s aos 60 s. */
  const ran = () => applySamples(startRun(T0, 1000, true), straight(0, 30, 4));
  const stopped = () => applySamples(ran(), Array.from({ length: 30 }, (_, i) => north(120, 31 + i)));

  it('parada gravada: mostra o selo, o tempo congelado e o pace sem leitura, e ainda Pausar', async () => {
    runRepository.set(stopped());
    await render(<RunScreen />);

    expect(screen.getByText('⏸ Pausa automática')).toBeOnTheScreen();
    expect(screen.queryByText('⏸ Pausada')).toBeNull();
    expect(screen.getByText('Parado: o tempo volta a contar quando você andar de novo.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tempo: 38 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: sem leitura')).toBeOnTheScreen();
    expect(screen.getByText('--:--')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Finalizar' })).toBeNull();
  });

  it('GPS calado há mais de 8 s: já mostra a pausa e esconde o pace', async () => {
    // Sem amostra depois dos 30 s e o relógio real bem depois: a pausa vale pelo relógio.
    runRepository.set(ran());
    await render(<RunScreen />);

    expect(screen.getByText('⏸ Pausa automática')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tempo: 38 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace atual: sem leitura')).toBeOnTheScreen();
  });

  it('com a pausa automática desligada na corrida, não mostra o selo', async () => {
    runRepository.set(applySamples(startRun(T0), straight(0, 30, 4)));
    await render(<RunScreen />);

    expect(screen.queryByText('⏸ Pausa automática')).toBeNull();
    expect(screen.getByLabelText('Pace atual: 4:10 por quilômetro')).toBeOnTheScreen();
  });

  it('pausar pelo botão durante a automática troca o selo e guarda o tempo congelado', async () => {
    runRepository.set(stopped());
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Pausar' }));

    expect(runRepository.get()).toMatchObject({ status: 'paused', autoPaused: false, movingMs: 38_000 });
    expect(screen.getByText('⏸ Pausada')).toBeOnTheScreen();
    expect(screen.queryByText('⏸ Pausa automática')).toBeNull();
  });
});

describe('Correr: trajeto', () => {
  /** 2,4 km em linha reta, com o trajeto guardado (um ponto a cada 12 m). */
  const finishedWithRoute = () =>
    finishRun(applySamples(startRun(T0, 1000, false, true), straight(0, 600, 4)), T0 + 600_000);
  const routeImage = () => screen.queryByRole('image', { name: 'Trajeto da corrida, com início e fim marcados' });

  it.each([true, false])('começa guardando o trajeto conforme os Ajustes (%s)', async (keepRoute) => {
    routePreference.set(keepRoute);
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));
    expect(runRepository.get()?.route).toEqual(keepRoute ? [] : null);
  });

  it('mostra o desenho do trajeto na corrida finalizada', async () => {
    runRepository.set(finishedWithRoute());
    await render(<RunScreen />);
    expect(screen.getByText('Trajeto')).toBeOnTheScreen();
    expect(routeImage()).toBeOnTheScreen();
  });

  it('salvar a corrida guarda o trajeto simplificado pelo id do treino', async () => {
    const run = finishedWithRoute();
    runRepository.set(run);
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const [saved] = workoutRepository.list();
    // Linha reta: só as pontas.
    expect(routeRepository.get(saved.id)).toEqual(simplifyRoute(run.route!));
    expect(routeRepository.get(saved.id)?.[0]).toHaveLength(2);
  });

  it('sem trajeto guardado, não mostra o desenho nem grava trajeto', async () => {
    runRepository.set(finished());
    const user = userEvent.setup();
    await render(<RunScreen />);
    expect(screen.queryByText('Trajeto')).toBeNull();
    expect(routeImage()).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(routeRepository.has(workoutRepository.list()[0].id)).toBe(false);
  });

  it('com um ponto só, não mostra o desenho nem grava trajeto', async () => {
    // Pausada logo após o primeiro ponto; o resto chega com a corrida parada.
    const one = { ...finished(), route: [[[-23.5, -46.6]]] as [number, number][][] };
    runRepository.set(one);
    const user = userEvent.setup();
    await render(<RunScreen />);
    expect(routeImage()).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(routeRepository.has(workoutRepository.list()[0].id)).toBe(false);
  });
});
