import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { CalculatorScreen } from '../CalculatorScreen';

beforeEach(() => preferencesRepository.setUnit('km'));

async function openIntervals() {
  const user = userEvent.setup();
  await render(<CalculatorScreen />);
  await user.press(screen.getByRole('radio', { name: 'Tiros' }));
  return user;
}

async function addLaps(user: ReturnType<typeof userEvent.setup>, laps: string[]) {
  for (const lap of laps) {
    await user.type(screen.getByLabelText(/^Tempo do tiro/), lap);
    await user.press(screen.getByRole('button', { name: 'Adicionar volta' }));
  }
}

describe('Modo Tiros', () => {
  it('mostra o tempo por tiro para um pace-alvo', async () => {
    const user = await openIntervals();
    await user.type(screen.getByLabelText('Pace-alvo (min/km)'), '3:50');
    expect(screen.getByLabelText('400 metros: 1 minuto e 32 segundos')).toBeOnTheScreen();
    expect(screen.getByLabelText('1000 metros: 3 minutos e 50 segundos')).toBeOnTheScreen();
  });

  it('sugere o pace de intervalado do esforço calculado no modo Ritmo', async () => {
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await user.type(screen.getByLabelText(/^Distância/), '5');
    await user.type(screen.getByLabelText('Tempo'), '19:57');
    await user.press(screen.getByRole('radio', { name: 'Tiros' }));
    expect(screen.getByText(/Usando o pace de intervalado sugerido/)).toBeOnTheScreen();
    expect(screen.getByLabelText('400 metros: 1 minuto e 34 segundos')).toBeOnTheScreen();
  });

  it('registra voltas em segundos ou m:ss, marca melhor e pior e permite remover', async () => {
    const user = await openIntervals();
    await addLaps(user, ['92', '1:30', '94']);

    expect(screen.getByText(/^2\. 1:30 · melhor$/)).toBeOnTheScreen();
    expect(screen.getByText(/^3\. 1:34 · pior$/)).toBeOnTheScreen();
    expect(screen.getByText('Média 1:32 · melhor 1:30 · pior 1:34')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Remover tiro 3' }));
    expect(screen.getByText('Média 1:31 · melhor 1:30 · pior 1:32')).toBeOnTheScreen();
  });

  it('pace-alvo digitado só com números vira m:ss', async () => {
    const user = await openIntervals();
    await user.type(screen.getByLabelText('Pace-alvo (min/km)'), '350');
    expect(screen.getByLabelText('Pace-alvo (min/km)')).toHaveDisplayValue('3:50');
    expect(screen.getByLabelText('400 metros: 1 minuto e 32 segundos')).toBeOnTheScreen();
  });

  it('volta digitada só com números: "132" é 1:32 e "94" continua sendo 94 s', async () => {
    const user = await openIntervals();
    await user.type(screen.getByLabelText(/^Tempo do tiro/), '132');
    expect(screen.getByLabelText(/^Tempo do tiro/)).toHaveDisplayValue('1:32');
    await user.press(screen.getByRole('button', { name: 'Adicionar volta' }));
    await addLaps(user, ['94']);

    expect(screen.getByText(/^1\. 1:32 · melhor$/)).toBeOnTheScreen();
    expect(screen.getByText(/^2\. 1:34 · pior$/)).toBeOnTheScreen();
    expect(screen.getByText('Média 1:33 · melhor 1:32 · pior 1:34')).toBeOnTheScreen();
  });

  it('salva a série no diário como treino de pista', async () => {
    const before = workoutRepository.list().length;
    const user = await openIntervals();
    await addLaps(user, ['92', '90', '94', '92']);
    await user.press(screen.getByRole('radio', { name: 'esforço 8' }));
    await user.press(screen.getByRole('button', { name: 'Salvar série no diário' }));

    expect(screen.getByText('✓ Série salva no diário')).toBeOnTheScreen();
    const saved = workoutRepository.list();
    expect(saved).toHaveLength(before + 1);
    expect(saved.find((w) => w.note?.startsWith('4×400 m'))).toMatchObject({
      terrain: 'pista',
      distanceMeters: 1600,
      durationSeconds: 368,
      rpe: 8,
      note: '4×400 m · média 1:32 (3:50/km) · variação 4 s',
    });
  });

  it('aceita uma distância de tiro própria', async () => {
    const user = await openIntervals();
    await user.press(screen.getByRole('radio', { name: 'Outra' }));
    await user.type(screen.getByLabelText('Distância (m)'), '600');
    await addLaps(user, ['2:15']);
    expect(screen.getByText(/^1×600 m · média 2:15 \(3:45\/km\)/)).toBeOnTheScreen();
  });
});
