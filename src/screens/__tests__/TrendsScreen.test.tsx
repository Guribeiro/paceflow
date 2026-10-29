import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { TrendsScreen } from '../TrendsScreen';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

function add(dateIso: string, distanceMeters: number, durationSeconds: number) {
  const result = workoutRepository.create({ date: dateIso, distanceMeters, durationSeconds, terrain: 'rua' });
  if (!result.ok) throw new Error(result.error);
}

beforeEach(() => preferencesRepository.setUnit('km'));

describe('TrendsScreen', () => {
  // Os testes compartilham o MMKV mock deste arquivo; o primeiro roda vazio.
  it('mostra o estado vazio sem treinos', async () => {
    await render(<TrendsScreen />);
    expect(screen.getByText(/Registre treinos para ver sua evolução/)).toBeOnTheScreen();
  });

  it('mostra a semana atual, os números e permite ver outra semana', async () => {
    add(daysAgo(0), 10000, 3000);
    add(daysAgo(14), 8000, 2400);
    add(daysAgo(14), 12000, 3600);
    const user = userEvent.setup();
    await render(<TrendsScreen />);

    expect(screen.getByText(/^Esta semana: 10,00 km · 1 treino · 5:00\/km/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Média semanal: 15,00 km, em 2 semanas ativas/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Melhor semana: 20,00 km/)).toBeOnTheScreen();

    const bars = screen.getAllByRole('button', { name: /^Semana de/ });
    expect(bars).toHaveLength(12);
    await user.press(screen.getByRole('button', { name: /20,0 quilômetros, 2 treinos/ }));
    expect(screen.getByText(/^Semana de \d{2}\/\d{2}: 20,00 km · 2 treinos/)).toBeOnTheScreen();
  });

  it('segue a unidade preferida', async () => {
    preferencesRepository.setUnit('mi');
    await render(<TrendsScreen />);
    expect(screen.getByText(/Distância por semana \(mi\)/)).toBeOnTheScreen();
    expect(screen.getByText(/^Esta semana: 6,21 mi/)).toBeOnTheScreen();
  });

  it('mostra e oculta a tabela', async () => {
    const user = userEvent.setup();
    await render(<TrendsScreen />);
    await user.press(screen.getByRole('button', { name: 'Ver como tabela' }));
    expect(screen.getAllByText(/km · \d+$/)).toHaveLength(12);
    await user.press(screen.getByRole('button', { name: 'Ocultar tabela' }));
    expect(screen.queryAllByText(/km · \d+$/)).toHaveLength(0);
  });
});
