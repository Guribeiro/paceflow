import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { shareFile } from '../../data/export/share-file';
import { routeRepository } from '../../data/routes';
import { workoutRepository } from '../../data/workouts';
import { SettingsScreen } from '../SettingsScreen';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

jest.mock('../../data/export/share-file', () => ({ shareFile: jest.fn(() => Promise.resolve()) }));
const mockShareFile = jest.mocked(shareFile);

function addWorkout() {
  const result = workoutRepository.create({
    date: new Date().toISOString(),
    distanceMeters: 10000,
    durationSeconds: 3000,
    terrain: 'rua',
    rpe: 6,
    note: 'Longão leve',
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('WorkoutLogScreen', () => {
  // Os testes compartilham o MMKV mock deste arquivo; o primeiro roda com o diário vazio.
  it('mostra o estado vazio e a semana zerada', async () => {
    await render(<WorkoutLogScreen />);
    expect(screen.getByText(/Nenhum treino ainda/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Esta semana: 0,0 quilômetros, 0 treinos/)).toBeOnTheScreen();
    // O Backup fica em Ajustes, não no Diário.
    expect(screen.queryByRole('button', { name: 'Importar backup JSON' })).not.toBeOnTheScreen();
  });

  it('lista o treino e soma no resumo da semana', async () => {
    addWorkout();
    await render(<WorkoutLogScreen />);
    expect(screen.getByLabelText(/^Esta semana: 10,0 quilômetros, 1 treino,/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/10,00 quilômetros em 50 minutos, pace de 5 minutos por quilômetro, Rua, esforço 6, Longão leve/)).toBeOnTheScreen();
  });

  it('atualiza a lista quando um treino é salvo com a tela aberta', async () => {
    await render(<WorkoutLogScreen />);
    const before = screen.getAllByRole('button', { name: 'Editar treino' }).length;
    await act(async () => {
      addWorkout();
    });
    expect(screen.getAllByRole('button', { name: 'Editar treino' })).toHaveLength(before + 1);
  });

  it('edita terreno, RPE e nota', async () => {
    const workout = addWorkout();
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    // O treino mais recente é o primeiro da lista.
    await user.press(screen.getAllByRole('button', { name: 'Editar treino' })[0]);
    await user.press(screen.getByRole('radio', { name: 'Esteira' }));
    await user.press(screen.getByRole('radio', { name: 'esforço 6' })); // desmarca
    await user.clear(screen.getByLabelText('Nota'));
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    const updated = workoutRepository.getById(workout.id);
    expect(updated).toMatchObject({ terrain: 'esteira', distanceMeters: 10000, durationSeconds: 3000 });
    expect(updated).not.toHaveProperty('rpe');
    expect(updated).not.toHaveProperty('note');
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeOnTheScreen();
  });

  it('muda o dia do treino na edição e preserva a hora se o dia não mudar', async () => {
    const workout = addWorkout();
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    await user.press(screen.getAllByRole('button', { name: 'Editar treino' })[0]);
    expect(screen.getByRole('radio', { name: 'Hoje' })).toBeChecked();
    await user.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(workoutRepository.getById(workout.id)?.date).toBe(workout.date);

    await user.press(screen.getAllByRole('button', { name: 'Editar treino' })[0]);
    await user.press(screen.getByRole('radio', { name: 'Ontem' }));
    await user.press(screen.getByRole('button', { name: 'Salvar' }));
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(new Date(workoutRepository.getById(workout.id)!.date).toDateString()).toBe(yesterday.toDateString());
  });

  it('edita o tempo pré-preenchido apagando e digitando só números', async () => {
    const workout = addWorkout();
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    await user.press(screen.getAllByRole('button', { name: 'Editar treino' })[0]);
    const field = screen.getByLabelText('Tempo');
    expect(field).toHaveDisplayValue('50:00');
    await user.type(field, '{Backspace}{Backspace}');
    expect(screen.getByLabelText('Tempo')).toHaveDisplayValue('50');
    await user.type(screen.getByLabelText('Tempo'), '30');
    expect(screen.getByLabelText('Tempo')).toHaveDisplayValue('50:30');
    await user.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(workoutRepository.getById(workout.id)).toMatchObject({ distanceMeters: 10000, durationSeconds: 3030 });
  });

  it('não deixa salvar a edição com tempo inválido', async () => {
    addWorkout();
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    await user.press(screen.getAllByRole('button', { name: 'Editar treino' })[0]);
    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '50:99');

    expect(screen.getByText('Use mm:ss ou h:mm:ss')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('exclui o treino após confirmação', async () => {
    const workout = addWorkout();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Excluir')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);
    const before = screen.getAllByRole('button', { name: 'Excluir treino' }).length;

    await user.press(screen.getAllByRole('button', { name: 'Excluir treino' })[0]);

    expect(workoutRepository.getById(workout.id)).toBeUndefined();
    expect(screen.getAllByRole('button', { name: 'Excluir treino' })).toHaveLength(before - 1);
  });

  describe('exportação (em Ajustes)', () => {
    beforeEach(() => mockShareFile.mockClear());

    it('exporta CSV com o nome e o tipo corretos', async () => {
      addWorkout();
      const user = userEvent.setup();
      await render(<SettingsScreen />);

      await user.press(screen.getByRole('button', { name: 'Exportar CSV' }));

      expect(mockShareFile).toHaveBeenCalledTimes(1);
      const [name, content, mime] = mockShareFile.mock.calls[0];
      expect(name).toMatch(/^paceflow-treinos-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mime).toBe('text/csv');
      expect(content).toContain('data;hora;distancia_km');
      expect(content).toContain('Longão leve');
    });

    it('exporta JSON com os treinos ativos', async () => {
      addWorkout();
      const user = userEvent.setup();
      await render(<SettingsScreen />);

      await user.press(screen.getByRole('button', { name: 'Exportar JSON' }));

      const [name, content, mime] = mockShareFile.mock.calls[0];
      expect(name).toMatch(/\.json$/);
      expect(mime).toBe('application/json');
      expect(JSON.parse(content).workouts).toHaveLength(workoutRepository.list().length);
    });

    it('exporta no JSON o trajeto dos treinos ativos', async () => {
      const kept = addWorkout();
      const removed = addWorkout();
      const route: [number, number][][] = [
        [
          [-23.55, -46.63],
          [-23.551, -46.631],
        ],
      ];
      routeRepository.set(kept.id, route);
      routeRepository.set(removed.id, route);
      workoutRepository.remove(removed.id);
      const user = userEvent.setup();
      await render(<SettingsScreen />);

      await user.press(screen.getByRole('button', { name: 'Exportar JSON' }));

      const { schemaVersion, routes } = JSON.parse(mockShareFile.mock.calls[0][1]);
      expect(schemaVersion).toBe(4);
      expect(routes).toEqual({ [kept.id]: route });
    });

    it('mostra erro se o compartilhamento falhar', async () => {
      addWorkout();
      mockShareFile.mockRejectedValueOnce(new Error('SHARING_UNAVAILABLE'));
      const user = userEvent.setup();
      await render(<SettingsScreen />);

      await user.press(screen.getByRole('button', { name: 'Exportar CSV' }));

      expect(await screen.findByText('Não foi possível exportar. Tente de novo.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
    });
  });
});

describe('WorkoutLogScreen: parciais salvas', () => {
  function addRun(extra: { splits?: number[]; splitMeters?: number } = {}) {
    const result = workoutRepository.create({
      date: new Date().toISOString(),
      distanceMeters: 3000,
      durationSeconds: 915,
      terrain: 'rua',
      ...extra,
    });
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  // O MMKV é compartilhado com os testes acima: cada teste começa com o diário vazio.
  beforeEach(() => {
    workoutRepository.list().forEach((w) => workoutRepository.remove(w.id));
  });

  it('mostra Ver parciais só no treino que tem parciais', async () => {
    addRun();
    addRun({ splits: [310, 299.6, 305], splitMeters: 1000 });
    await render(<WorkoutLogScreen />);

    expect(screen.getAllByRole('button', { name: 'Editar treino' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Ver parciais' })).toHaveLength(1);
  });

  it('abre a lista com a parcial mais rápida em destaque e fecha de novo', async () => {
    addRun({ splits: [310, 299.6, 305], splitMeters: 1000 });
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    expect(screen.queryByLabelText(/^Quilômetro \d: /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver parciais' })).toBeCollapsed();

    await user.press(screen.getByRole('button', { name: 'Ver parciais' }));

    expect(screen.getByRole('button', { name: 'Ocultar parciais' })).toBeExpanded();
    expect(screen.getByLabelText('Quilômetro 1: 5 minutos e 10 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 2: 5 minutos, a mais rápida')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quilômetro 3: 5 minutos e 5 segundos')).toBeOnTheScreen();
    expect(screen.getByText('2 km · mais rápida')).toBeOnTheScreen();
    expect(screen.getAllByText(/mais rápida/)).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Ocultar parciais' }));
    expect(screen.queryByLabelText(/^Quilômetro \d: /)).toBeNull();
  });

  it('parciais em milha usam a unidade da gravação', async () => {
    addRun({ splits: [402.3], splitMeters: 1609.344 });
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    await user.press(screen.getByRole('button', { name: 'Ver parciais' }));
    expect(screen.getByLabelText('Milha 1: 6 minutos e 42 segundos')).toBeOnTheScreen();
    expect(screen.getByText('1 mi')).toBeOnTheScreen();
  });
});

describe('WorkoutLogScreen: trajeto salvo', () => {
  const route: [number, number][][] = [
    [
      [-23.55, -46.63],
      [-23.551, -46.631],
    ],
  ];
  const routeImage = () => screen.queryByRole('image', { name: 'Trajeto da corrida, com início e fim marcados' });

  beforeEach(() => {
    workoutRepository.list().forEach((w) => workoutRepository.remove(w.id));
  });

  afterEach(() => jest.restoreAllMocks());

  it('mostra Ver trajeto só no treino que tem trajeto', async () => {
    addWorkout();
    routeRepository.set(addWorkout().id, route);
    await render(<WorkoutLogScreen />);

    expect(screen.getAllByRole('button', { name: 'Editar treino' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Ver trajeto' })).toHaveLength(1);
  });

  it('abre o desenho do trajeto e fecha de novo', async () => {
    routeRepository.set(addWorkout().id, route);
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    expect(routeImage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver trajeto' })).toBeCollapsed();

    await user.press(screen.getByRole('button', { name: 'Ver trajeto' }));
    expect(screen.getByRole('button', { name: 'Ocultar trajeto' })).toBeExpanded();
    expect(routeImage()).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Ocultar trajeto' }));
    expect(routeImage()).toBeNull();
  });

  it('só lê o trajeto ao abrir', async () => {
    routeRepository.set(addWorkout().id, route);
    const get = jest.spyOn(routeRepository, 'get');
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);
    expect(get).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Ver trajeto' }));
    expect(get).toHaveBeenCalled();
  });

  it('trajeto corrompido abre sem desenho e sem quebrar a tela', async () => {
    const workout = addWorkout();
    routeRepository.set(workout.id, route);
    // Grava lixo na mesma chave, como um salvo corrompido.
    routeRepository.set(workout.id, 'lixo' as unknown as [number, number][][]);
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    await user.press(screen.getByRole('button', { name: 'Ver trajeto' }));
    expect(routeImage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar treino' })).toBeOnTheScreen();
  });

  it('mostra Ver trajeto quando o treino e o trajeto chegam com a tela aberta', async () => {
    await render(<WorkoutLogScreen />);
    await act(async () => {
      // Mesma ordem do formulário da corrida: o treino primeiro, depois o trajeto.
      routeRepository.set(addWorkout().id, route);
    });
    expect(screen.getByRole('button', { name: 'Ver trajeto' })).toBeOnTheScreen();
  });

  it('excluir o treino apaga o trajeto dele', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const created = workoutRepository.create({
      date: yesterday.toISOString(),
      distanceMeters: 5000,
      durationSeconds: 1500,
      terrain: 'rua',
    });
    if (!created.ok) throw new Error(created.error);
    const workout = created.value;
    const other = addWorkout();
    routeRepository.set(workout.id, route);
    routeRepository.set(other.id, route);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Excluir')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);

    // O de hoje (other) é o primeiro da lista; o de ontem, o segundo.
    await user.press(screen.getAllByRole('button', { name: 'Excluir treino' })[1]);

    expect(workoutRepository.getById(workout.id)).toBeUndefined();
    expect(routeRepository.has(workout.id)).toBe(false);
    expect(routeRepository.has(other.id)).toBe(true);
  });
});
