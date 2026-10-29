import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { CalculatorScreen } from '../CalculatorScreen';
import { TrendsScreen } from '../TrendsScreen';

beforeEach(() => {
  preferencesRepository.setUnit('km');
});

describe('Recordes pessoais', () => {
  // Os testes compartilham o MMKV mock deste arquivo; o primeiro roda com o diário vazio.
  it('comemora a primeira marca e depois um recorde novo ao salvar', async () => {
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await user.type(screen.getByLabelText(/^Distância/), '5');
    await user.type(screen.getByLabelText('Tempo'), '25:00');
    await user.press(screen.getByRole('radio', { name: 'Rua' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(screen.getByText(/Primeira marca nos 5 km: 25:00/)).toBeOnTheScreen();

    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '24:10');
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(screen.getByText(/Novo recorde nos 5 km: 24:10/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Novo recorde nos 5 km: 24 minutos e 10 segundos/)).toBeOnTheScreen();

    // Mais lento que o recorde: só "salvo", sem comemoração.
    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '26:00');
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(screen.getByText('✓ Treino salvo no diário')).toBeOnTheScreen();
  });

  it('mostra os recordes na Evolução', async () => {
    workoutRepository.create({
      date: new Date().toISOString(),
      distanceMeters: 10_000,
      durationSeconds: 50 * 60,
      terrain: 'rua',
    });
    await render(<TrendsScreen />);

    expect(screen.getByText('Recordes')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^5 km: 24 minutos e 10 segundos, pace 4:50 por quilômetro/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^10 km: 50 minutos, pace 5:00 por quilômetro/)).toBeOnTheScreen();
  });
});
