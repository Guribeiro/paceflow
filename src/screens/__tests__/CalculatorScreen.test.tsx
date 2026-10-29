import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { CalculatorScreen } from '../CalculatorScreen';

beforeEach(() => {
  preferencesRepository.setUnit('km');
});

async function fillIn(distance: string, time: string) {
  const user = userEvent.setup();
  await render(<CalculatorScreen />);
  await user.type(screen.getByLabelText(/^Distância/), distance);
  await user.type(screen.getByLabelText('Tempo'), time);
  return user;
}

describe('CalculatorScreen', () => {
  it('calcula pace e velocidade enquanto o usuário digita', async () => {
    await fillIn('5', '25:00');
    expect(screen.getByLabelText('Pace: 5 minutos por quilômetro')).toBeOnTheScreen();
    expect(screen.getByLabelText('Velocidade média: 12,0 km/h')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^10 km: 52 minutos e 7 segundos/)).toBeOnTheScreen();
  });

  it('mostra erro para tempo mal formatado e não calcula', async () => {
    await fillIn('5', '5:75');
    expect(screen.getByText('Use mm:ss ou h:mm:ss')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace: informe distância e tempo')).toBeOnTheScreen();
    expect(screen.queryByText('Registrar no diário')).not.toBeOnTheScreen();
  });

  it('troca para milhas e lembra a preferência', async () => {
    const user = await fillIn('1', '8:00');
    await user.press(screen.getByRole('radio', { name: 'milhas' }));
    expect(screen.getByLabelText('Pace: 8 minutos por milha')).toBeOnTheScreen();
    expect(preferencesRepository.getUnit()).toBe('mi');
  });

  it('salva o treino no diário com terreno e RPE', async () => {
    const before = workoutRepository.list().length;
    const user = await fillIn('5', '25:00');

    const save = screen.getByRole('button', { name: 'Escolha o terreno' });
    expect(save).toBeDisabled();

    await user.press(screen.getByRole('radio', { name: 'Pista' }));
    await user.press(screen.getByRole('radio', { name: 'esforço 7' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    expect(screen.getByText('✓ Treino salvo no diário')).toBeOnTheScreen();
    const workouts = workoutRepository.list();
    expect(workouts).toHaveLength(before + 1);
    expect(workouts[0]).toMatchObject({ distanceMeters: 5000, durationSeconds: 1500, terrain: 'pista', rpe: 7 });
  });

  it('registra o treino no dia escolhido, mantendo a hora atual', async () => {
    const user = await fillIn('5', '25:00');
    expect(screen.getByRole('radio', { name: 'Hoje' })).toBeChecked();

    await user.press(screen.getByRole('radio', { name: 'Ontem' }));
    await user.press(screen.getByRole('radio', { name: 'Rua' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const saved = new Date(workoutRepository.list().find((w) => w.terrain === 'rua')!.date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(saved.toDateString()).toBe(yesterday.toDateString());
  });
});

