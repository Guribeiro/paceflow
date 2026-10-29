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
  });

  it('mostra registrar logo após o resultado e a projeção recolhida', async () => {
    const user = await fillIn('5', '25:00');
    const toggle = screen.getByRole('button', { name: 'Ver projeção' });
    expect(toggle).toBeCollapsed();
    expect(screen.queryByLabelText(/^10 km:/)).not.toBeOnTheScreen();
    // Registrar vem antes das consultas na ordem de leitura.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Registrar no diário')).toBeLessThan(tree.indexOf('Ver projeção'));
    expect(tree.indexOf('Ver projeção')).toBeLessThan(tree.indexOf('Ver paces'));

    await user.press(toggle);
    expect(screen.getByRole('button', { name: 'Ocultar projeção' })).toBeExpanded();
    expect(screen.getByLabelText(/^10 km: 52 minutos e 7 segundos/)).toBeOnTheScreen();
  });

  it('mostra erro para tempo mal formatado e não calcula', async () => {
    await fillIn('5', '5:75');
    expect(screen.getByText('Use mm:ss ou h:mm:ss')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pace: informe distância e tempo')).toBeOnTheScreen();
    // "5:7" chegou a calcular enquanto digitava; o formulário segue montado, mas sem salvar.
    expect(screen.getByRole('button', { name: 'Informe distância e tempo' })).toBeDisabled();
  });

  it('corrigir o tempo não apaga o que foi escolhido no registro', async () => {
    const user = await fillIn('5', '25:00');
    await user.press(screen.getByRole('radio', { name: 'Pista' }));
    await user.type(screen.getByLabelText('Tempo'), 'x');
    expect(screen.getByRole('button', { name: 'Informe distância e tempo' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '24:00');
    expect(screen.getByRole('radio', { name: 'Pista' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Salvar treino' })).toBeEnabled();
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

    expect(screen.getByText(/^✓ Treino salvo no diário/)).toBeOnTheScreen();
    const workouts = workoutRepository.list();
    expect(workouts).toHaveLength(before + 1);
    expect(workouts[0]).toMatchObject({ distanceMeters: 5000, durationSeconds: 1500, terrain: 'pista', rpe: 7 });
  });

  it('não grava o mesmo treino duas vezes', async () => {
    const user = await fillIn('5', '25:00');
    await user.press(screen.getByRole('radio', { name: 'Esteira' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    const after = workoutRepository.list().length;

    const saved = screen.getByRole('button', { name: 'Treino salvo' });
    expect(saved).toBeDisabled();
    await user.press(saved);
    expect(workoutRepository.list()).toHaveLength(after);

    // Mudar um campo libera um novo registro.
    await user.press(screen.getByRole('radio', { name: 'esforço 5' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(workoutRepository.list()).toHaveLength(after + 1);
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

  it('sugere paces de treino a partir do esforço', async () => {
    const user = await fillIn('5', '19:57');
    await user.press(screen.getByRole('button', { name: 'Ver paces' }));
    expect(screen.getByLabelText(/^Limiar: 4 minutos e 15 segundos por quilômetro/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Intervalado: 3 minutos e 55 segundos por quilômetro, 1 minuto e 34 segundos a cada 400 metros/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Leve \/ longão: entre 5 minutos e 7 segundos e 5 minutos e 39 segundos/)).toBeOnTheScreen();
  });

  it('explica quando o esforço não serve para paces de treino', async () => {
    const user = await fillIn('0,4', '1:30');
    await user.press(screen.getByRole('button', { name: 'Ver paces' }));
    expect(screen.getByText(/Para sugerir paces de treino, use um esforço de prova entre 1,5 e 42,2 km/)).toBeOnTheScreen();
  });
});

