import { render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { SettingsScreen } from '../SettingsScreen';
import { TrendsScreen } from '../TrendsScreen';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

beforeEach(() => {
  preferencesRepository.setUnit('km');
  preferencesRepository.setWeeklyGoal(null);
});

describe('Meta semanal', () => {
  it('define e remove a meta em Ajustes', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    expect(screen.getByText(/^Sem meta/)).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Nova meta (km)'), '20');
    await user.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(preferencesRepository.getWeeklyGoal()).toBe(20000);
    expect(screen.getByText('Atual: 20,00 km por semana.')).toBeOnTheScreen();

    const alert = jest.spyOn(Alert, 'alert').mockImplementationOnce(() => {});
    await user.press(screen.getByRole('button', { name: 'Remover meta' }));
    expect(preferencesRepository.getWeeklyGoal()).toBe(20000); // cancelou

    alert.mockImplementationOnce((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Remover')?.onPress?.();
    });
    await user.press(screen.getByRole('button', { name: 'Remover meta' }));
    expect(preferencesRepository.getWeeklyGoal()).toBeNull();
  });

  it('meta digitada em milhas é guardada em metros', async () => {
    preferencesRepository.setUnit('mi');
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.type(screen.getByLabelText('Nova meta (mi)'), '10');
    await user.press(screen.getByRole('button', { name: 'Salvar meta' }));
    expect(preferencesRepository.getWeeklyGoal()).toBeCloseTo(16093.44, 6);
  });

  it('mostra o progresso no diário e a linha no gráfico', async () => {
    workoutRepository.create({ date: new Date().toISOString(), distanceMeters: 12400, durationSeconds: 3720, terrain: 'rua' });
    preferencesRepository.setWeeklyGoal(20000);

    await render(<WorkoutLogScreen />);
    expect(screen.getByText('12,40 de 20,00 km · faltam 7,60 km')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: 62 });

    await render(<TrendsScreen />);
    expect(screen.getByLabelText('Meta semanal: 20,00 quilômetros')).toBeOnTheScreen();
  });

  it('meta batida', async () => {
    preferencesRepository.setWeeklyGoal(10000);
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('Meta de 10,00 km batida! (124%)')).toBeOnTheScreen();
  });
});
