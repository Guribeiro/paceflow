import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { workoutRepository } from '../../data/workouts';
import { TrendsScreen } from '../TrendsScreen';

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inWeeks = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n * 7);
  return key(d);
};

// Linhas do plano trazem a fase; as barras do gráfico, não.
const PLAN_ROW = /^Semana de \d{2}\/\d{2}: (Base|Construção|Pico|Polimento|Semana da prova),/;

beforeEach(() => {
  preferencesRepository.setUnit('km');
  preferencesRepository.setRaceGoal(null);
});

describe('Plano até a prova', () => {
  it('não aparece sem prova-alvo', async () => {
    await render(<TrendsScreen />);
    expect(screen.queryByText('Plano até a prova')).not.toBeOnTheScreen();
  });

  it('mostra a semana atual com treinos-chave e paces da meta', async () => {
    preferencesRepository.setRaceGoal({ distanceKm: 21.0975, date: inWeeks(10), targetSeconds: 6300 });
    await render(<TrendsScreen />);

    expect(screen.getByText('Plano até a prova')).toBeOnTheScreen();
    expect(screen.getByText(/^Esta semana · Base/)).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: /^Volume da semana: 0,00 de 25,00 km/ })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Limiar: \d×5 min no ritmo de limiar, pace 4:5\d\/km/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Longão: 7,0 km em ritmo leve/)).toBeOnTheScreen();
  });

  it('marca o longão feito pelo diário', async () => {
    preferencesRepository.setRaceGoal({ distanceKm: 21.0975, date: inWeeks(10), targetSeconds: 6300 });
    workoutRepository.create({ date: new Date().toISOString(), distanceMeters: 7000, durationSeconds: 2520, terrain: 'rua' });
    await render(<TrendsScreen />);
    expect(screen.getByLabelText(/^Longão, feito:/)).toBeOnTheScreen();
  });

  it('lista as próximas semanas e expande todas', async () => {
    preferencesRepository.setRaceGoal({ distanceKm: 42.195, date: inWeeks(16) });
    const user = userEvent.setup();
    await render(<TrendsScreen />);
    expect(screen.getAllByLabelText(PLAN_ROW)).toHaveLength(4);
    await user.press(screen.getByRole('button', { name: 'Ver todas as 16 semanas' }));
    expect(screen.getAllByLabelText(PLAN_ROW)).toHaveLength(16);
    expect(screen.getByLabelText(/Semana da prova, .*, com a prova$/)).toBeOnTheScreen();
  });
});
