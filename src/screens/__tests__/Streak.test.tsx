import { act, render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { reminderPreferences } from '../../data/reminders';
import { storage } from '../../data/storage/mmkv';
import { workoutRepository } from '../../data/workouts';
import { DEFAULT_REMINDER_PREFERENCES } from '../../domain/reminders';
import { startOfWeek } from '../../domain/workout-summary';
import { CalculatorScreen } from '../CalculatorScreen';
import { SettingsScreen } from '../SettingsScreen';
import { TrendsScreen } from '../TrendsScreen';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

// Datas relativas ao relógio real: segunda ao meio-dia de `n` semanas atrás
// (sempre no passado) ou agora, para a semana atual.
function weeksAgo(n: number): Date {
  const monday = startOfWeek(new Date());
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * n, 12);
}

function add(date: Date, distanceMeters = 5_000) {
  const result = workoutRepository.create({
    date: date.toISOString(),
    distanceMeters,
    durationSeconds: distanceMeters * 0.3,
    terrain: 'rua',
  });
  if (!result.ok) throw new Error(result.error);
}

// O MMKV mock é compartilhado pelos testes do arquivo: cada teste começa
// com o diário vazio, sem meta e sem histórico da meta.
beforeEach(() => {
  for (const w of workoutRepository.list()) workoutRepository.remove(w.id);
  preferencesRepository.setUnit('km');
  preferencesRepository.setWeeklyGoal(null);
  storage.remove('prefs:v1:weeklyGoalHistory');
  reminderPreferences.update(DEFAULT_REMINDER_PREFERENCES);
});

describe('Sequência no Diário', () => {
  it('sem treinos, convida a começar', async () => {
    await render(<WorkoutLogScreen />);
    expect(
      screen.getByLabelText('Sequência: 0 semanas. Melhor: 0 semanas. Falta uma corrida para começar uma sequência.'),
    ).toBeOnTheScreen();
  });

  it('com meta, mostra quanto falta para manter a sequência', async () => {
    add(weeksAgo(2));
    add(weeksAgo(1));
    add(new Date(), 12_500);
    // A meta definida agora vale desta semana em diante; as anteriores contam com um treino.
    preferencesRepository.setWeeklyGoal(20_000);
    await render(<WorkoutLogScreen />);
    expect(
      screen.getByLabelText('Sequência: 2 semanas. Melhor: 2 semanas. Falta 7,50 km para manter a sequência.'),
    ).toBeOnTheScreen();
  });

  it('as semanas passadas valem pela meta da época', async () => {
    storage.set('prefs:v1:weeklyGoal', '10000'); // meta antiga, de antes do histórico
    add(weeksAgo(1), 12_000);
    preferencesRepository.setWeeklyGoal(20_000); // subiu nesta semana
    await render(<WorkoutLogScreen />);
    expect(screen.getByLabelText(/^Sequência: 1 semana\. Melhor: 1 semana\. Falta 20,00 km para manter/)).toBeOnTheScreen();
  });

  it('atualiza ao salvar um treino com a tela aberta', async () => {
    add(weeksAgo(1));
    await render(<WorkoutLogScreen />);
    expect(screen.getByLabelText(/^Sequência: 1 semana\./)).toBeOnTheScreen();
    await act(async () => {
      add(new Date());
    });
    expect(screen.getByLabelText('Sequência: 2 semanas. Melhor: 2 semanas. Semana garantida!')).toBeOnTheScreen();
  });
});

describe('Sequência na Evolução', () => {
  it('mostra a sequência atual e a melhor', async () => {
    add(weeksAgo(5));
    add(weeksAgo(4));
    add(weeksAgo(3));
    // duas semanas atrás: nenhum treino
    add(weeksAgo(1));
    add(new Date());
    await render(<TrendsScreen />);
    expect(screen.getByLabelText('Sequência: 2 semanas, melhor: 3 semanas')).toBeOnTheScreen();
  });

  it('usa o singular com uma semana', async () => {
    add(weeksAgo(1));
    await render(<TrendsScreen />);
    expect(screen.getByLabelText('Sequência: 1 semana, melhor: 1 semana')).toBeOnTheScreen();
  });
});

describe('Lembrete da sequência nos Ajustes', () => {
  it('liga e desliga o lembrete "Sequência em risco"', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    const toggle = screen.getByRole('switch', { name: 'Sequência em risco' });
    expect(toggle).not.toBeChecked();
    await user.press(toggle);
    expect(screen.getByRole('switch', { name: 'Sequência em risco' })).toBeChecked();
    expect(reminderPreferences.get()).toEqual({ ...DEFAULT_REMINDER_PREFERENCES, streak: true });

    await user.press(screen.getByRole('switch', { name: 'Sequência em risco' }));
    expect(screen.getByRole('switch', { name: 'Sequência em risco' })).not.toBeChecked();
    expect(reminderPreferences.get().streak).toBe(false);
  });
});

describe('Comemoração da sequência ao salvar', () => {
  async function fillAndSave(user: ReturnType<typeof userEvent.setup>, km: string, time: string) {
    await user.type(screen.getByLabelText(/^Distância/), km);
    await user.type(screen.getByLabelText('Tempo'), time);
    await user.press(screen.getByRole('radio', { name: 'Rua' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
  }

  it('o treino que garante a semana estende a sequência; o seguinte só salva', async () => {
    add(weeksAgo(2));
    add(weeksAgo(1));
    const user = userEvent.setup();
    await render(<CalculatorScreen />);

    // 3 km não é distância de recorde: a mensagem é só a da sequência.
    await fillAndSave(user, '3', '15:00');
    expect(screen.getByText('✓ Treino salvo no diário\n🔥 Sequência de 3 semanas!')).toBeOnTheScreen();
    expect(screen.getByLabelText('Treino salvo no diário. Sequência de 3 semanas!')).toBeOnTheScreen();

    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '16:00');
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(screen.getByText('✓ Treino salvo no diário')).toBeOnTheScreen();
  });

  it('sem sequência anterior, comemora o início', async () => {
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await fillAndSave(user, '3', '15:00');
    expect(screen.getByText('✓ Treino salvo no diário\n🔥 Semana garantida: sequência iniciada!')).toBeOnTheScreen();
  });

  it('abaixo da meta, ainda não comemora', async () => {
    add(weeksAgo(1), 20_000);
    preferencesRepository.setWeeklyGoal(20_000);
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await fillAndSave(user, '3', '15:00');
    expect(screen.getByText('✓ Treino salvo no diário')).toBeOnTheScreen();
    expect(screen.queryByText(/Sequência/)).not.toBeOnTheScreen();
  });

  it('junta a comemoração da sequência à do recorde', async () => {
    add(weeksAgo(1), 3_000);
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await fillAndSave(user, '5', '25:00');
    expect(
      screen.getByText('✓ Treino salvo no diário\n🏆 Primeira marca nos 5 km: 25:00\n🔥 Sequência de 2 semanas!'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Treino salvo no diário. Primeira marca nos 5 km: 25 minutos. Sequência de 2 semanas!'),
    ).toBeOnTheScreen();
  });
});
