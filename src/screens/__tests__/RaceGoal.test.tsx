import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { TrendsScreen } from '../TrendsScreen';

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

beforeEach(() => {
  preferencesRepository.setUnit('km');
  preferencesRepository.setRaceGoal(null);
});

describe('Prova-alvo na Evolução', () => {
  it('define a prova e mostra contagem, meta e paces da meta', async () => {
    const user = userEvent.setup();
    await render(<TrendsScreen />);
    await user.press(screen.getByRole('button', { name: 'Definir prova-alvo' }));

    // Meia maratona já vem selecionada; 8 semanas pelo atalho.
    await user.press(screen.getByRole('radio', { name: '8 semanas' }));
    await user.type(screen.getByLabelText('Tempo-alvo (opcional)'), '1:45:00');
    await user.press(screen.getByRole('button', { name: 'Salvar prova' }));

    expect(preferencesRepository.getRaceGoal()).toMatchObject({ distanceKm: 21.0975, targetSeconds: 6300 });
    expect(screen.getByText('Meia Maratona')).toBeOnTheScreen();
    expect(screen.getByText(/faltam 56 dias \(8 semanas\)/)).toBeOnTheScreen();
    expect(screen.getByText('Meta: 1:45:00 · 4:59/km')).toBeOnTheScreen();
    expect(screen.getByText('Paces para a meta')).toBeOnTheScreen();
    expect(screen.getByText(/Registre um treino forte/)).toBeOnTheScreen();
  });

  it('projeta a partir do melhor esforço recente e compara com a meta', async () => {
    workoutRepository.create({ date: daysFromNow(-10).toISOString(), distanceMeters: 5000, durationSeconds: 1197, terrain: 'rua' });
    preferencesRepository.setRaceGoal({ distanceKm: 10, date: ddmmyyyy(daysFromNow(30)).split('/').reverse().join('-'), targetSeconds: 2400 });
    await render(<TrendsScreen />);
    // Índice 50 → 10 km ≈ 41:22; meta 40:00 → faltam ≈ 1:22.
    expect(
      screen.getByText(/^Projeção atual: 41:2\d pelo seu treino de 5,00 km em 19:57 \(\d{2}\/\d{2}\) · faltam 1:2\d para a meta$/),
    ).toBeOnTheScreen();
  });

  it('valida a data digitada e remove a prova', async () => {
    const user = userEvent.setup();
    await render(<TrendsScreen />);
    await user.press(screen.getByRole('button', { name: 'Definir prova-alvo' }));
    await user.type(screen.getByLabelText('Data da prova (dd/mm/aaaa)'), '31/02/2027');
    expect(screen.getByText(/Use dd\/mm\/aaaa/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar prova' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Data da prova (dd/mm/aaaa)'));
    await user.type(screen.getByLabelText('Data da prova (dd/mm/aaaa)'), ddmmyyyy(daysFromNow(20)));
    await user.press(screen.getByRole('button', { name: 'Salvar prova' }));
    await user.press(screen.getByRole('button', { name: 'Remover' }));
    expect(preferencesRepository.getRaceGoal()).toBeNull();
    expect(screen.getByRole('button', { name: 'Definir prova-alvo' })).toBeOnTheScreen();
  });
});
