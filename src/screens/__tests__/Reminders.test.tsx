import * as Notifications from 'expo-notifications';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { reminderPreferences } from '../../data/reminders';
import { DEFAULT_REMINDER_PREFERENCES } from '../../domain/reminders';
import { SettingsScreen } from '../SettingsScreen';

const mocked = jest.mocked(Notifications);

beforeEach(() => {
  reminderPreferences.update(DEFAULT_REMINDER_PREFERENCES);
  jest.clearAllMocks();
});

describe('Lembretes nos Ajustes', () => {
  it('liga os lembretes de treino depois da permissão e escolhe dias e horário', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    const training = screen.getByRole('switch', { name: 'Dias de treino' });
    expect(training).not.toBeChecked();
    await user.press(training);

    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled(); // o mock já começa com permissão
    expect(screen.getByRole('switch', { name: 'Dias de treino' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Terça' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Segunda' })).not.toBeChecked();

    await user.press(screen.getByRole('checkbox', { name: 'Segunda' }));
    await user.press(screen.getByRole('checkbox', { name: 'Sábado' }));
    expect(reminderPreferences.get().trainingDays).toEqual([1, 2, 4]);

    await user.press(screen.getByRole('radio', { name: 'Às 18:00' }));
    expect(reminderPreferences.get().time).toBe('18:00');

    await user.type(screen.getByLabelText('Outro horário'), '5:45');
    await user.press(screen.getByRole('button', { name: 'Salvar horário' }));
    expect(reminderPreferences.get().time).toBe('05:45');
    expect(screen.getByText('Horário: 05:45')).toBeOnTheScreen();
  });

  it('outro horário digitado só com números ganha os ":" e é salvo como hh:mm', async () => {
    reminderPreferences.update({ training: true });
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.type(screen.getByLabelText('Outro horário'), '545');
    expect(screen.getByLabelText('Outro horário')).toHaveDisplayValue('5:45');
    await user.press(screen.getByRole('button', { name: 'Salvar horário' }));
    expect(reminderPreferences.get().time).toBe('05:45');
  });

  it('outro horário aceita no máximo quatro dígitos', async () => {
    reminderPreferences.update({ training: true });
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.type(screen.getByLabelText('Outro horário'), '19305');
    expect(screen.getByLabelText('Outro horário')).toHaveDisplayValue('19:30');
    await user.press(screen.getByRole('button', { name: 'Salvar horário' }));
    expect(reminderPreferences.get().time).toBe('19:30');
  });

  it('com a permissão negada, não liga e mostra o caminho nas configurações', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false } as never);
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.press(screen.getByRole('switch', { name: 'Prova chegando' }));
    expect(screen.getByRole('switch', { name: 'Prova chegando' })).not.toBeChecked();
    expect(reminderPreferences.get().race).toBe(false);
    expect(screen.getByText(/notificações do PaceFlow estão desativadas/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir configurações' })).toBeOnTheScreen();

    mocked.getPermissionsAsync.mockReset();
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  });

  it('desligar não pede permissão', async () => {
    reminderPreferences.update({ weeklyGoal: true });
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await waitFor(() => expect(mocked.getPermissionsAsync).toHaveBeenCalled());
    mocked.getPermissionsAsync.mockClear();

    await user.press(screen.getByRole('switch', { name: 'Meta da semana' }));
    expect(reminderPreferences.get().weeklyGoal).toBe(false);
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
  });
});
