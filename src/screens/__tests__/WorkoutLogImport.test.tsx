import { render, screen, userEvent } from '@testing-library/react-native';

import { pickTextFile } from '../../data/import/pick-text-file';
import { workoutRepository } from '../../data/workouts';
import { workoutsToJson } from '../../domain/export';
import type { Workout } from '../../domain/workout';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

jest.mock('../../data/import/pick-text-file', () => ({ pickTextFile: jest.fn() }));
const mockPickTextFile = jest.mocked(pickTextFile);

const backupWorkout = (id: string, overrides: Partial<Workout> = {}): Workout => ({
  id,
  date: new Date().toISOString(),
  distanceMeters: 8000,
  durationSeconds: 2400,
  terrain: 'pista',
  rpe: 7,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

async function pressImport() {
  const user = userEvent.setup();
  await render(<WorkoutLogScreen />);
  await user.press(screen.getByRole('button', { name: 'Importar backup JSON' }));
}

describe('WorkoutLogScreen — importação', () => {
  beforeEach(() => mockPickTextFile.mockReset());

  // Os testes compartilham o MMKV mock deste arquivo; o primeiro roda com o diário vazio.
  it('restaura um backup num diário vazio', async () => {
    expect(workoutRepository.list()).toHaveLength(0);
    mockPickTextFile.mockResolvedValue(
      workoutsToJson([backupWorkout('a1'), backupWorkout('b2', { note: 'Tiros' })], new Date()),
    );

    await pressImport();

    expect(await screen.findByText('2 treinos adicionados.')).toBeOnTheScreen();
    expect(workoutRepository.list().map((w) => w.id).sort()).toEqual(['a1', 'b2']);
    expect(screen.getAllByRole('button', { name: 'Editar treino' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeOnTheScreen();
  });

  it('importar o mesmo backup de novo não duplica', async () => {
    mockPickTextFile.mockResolvedValue(workoutsToJson([backupWorkout('a1'), backupWorkout('b2')], new Date()));
    await pressImport();
    expect(await screen.findByText('Nenhum treino novo: o diário já estava atualizado.')).toBeOnTheScreen();
    expect(workoutRepository.list()).toHaveLength(2);
  });

  it('atualiza o que mudou e informa registros inválidos', async () => {
    const json = JSON.stringify({
      app: 'PaceFlow',
      schemaVersion: 1,
      workouts: [
        { ...backupWorkout('a1', { terrain: 'esteira', updatedAt: '2026-10-02T10:00:00.000Z' }), deletedAt: undefined },
        { id: 'quebrado' },
      ],
    });
    mockPickTextFile.mockResolvedValue(json);

    await pressImport();

    expect(
      await screen.findByText('1 treino atualizado. 1 registro inválido ignorado.'),
    ).toBeOnTheScreen();
    expect(workoutRepository.getById('a1')).toMatchObject({ terrain: 'esteira' });
  });

  it.each([
    ['{quebrado', 'O arquivo não é um JSON válido.'],
    ['{"app":"Strava","workouts":[]}', 'Este arquivo não é um backup do PaceFlow.'],
  ])('mostra erro para %p', async (content, message) => {
    mockPickTextFile.mockResolvedValue(content);
    await pressImport();
    expect(await screen.findByText(message)).toBeOnTheScreen();
  });

  it('não mostra nada se o usuário cancelar', async () => {
    mockPickTextFile.mockResolvedValue(null);
    await pressImport();
    expect(mockPickTextFile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Importar backup JSON' })).toBeEnabled();
    expect(screen.queryByText(/Não foi possível importar/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/adicionado|atualizado|backup do PaceFlow/)).not.toBeOnTheScreen();
  });

  it('mostra erro se o seletor de arquivos falhar', async () => {
    mockPickTextFile.mockRejectedValue(new Error('módulo nativo ausente'));
    await pressImport();
    expect(await screen.findByText('Não foi possível importar. Tente de novo.')).toBeOnTheScreen();
  });

  it('backup versão 2 restaura os tênis junto', async () => {
    const shoe = {
      id: 'shoe-1',
      name: 'Pegasus',
      initialMeters: 0,
      limitMeters: 700000,
      retiredAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      deletedAt: null,
    };
    mockPickTextFile.mockResolvedValue(workoutsToJson([backupWorkout('c3', { shoeId: 'shoe-1' })], new Date(), [shoe]));
    await pressImport();
    expect(await screen.findByText('1 treino adicionado, 1 tênis adicionado.')).toBeOnTheScreen();
    expect(screen.getByText('Tênis: Pegasus')).toBeOnTheScreen();
  });
});

