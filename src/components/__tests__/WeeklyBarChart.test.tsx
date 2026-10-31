import { render, screen, userEvent } from '@testing-library/react-native';

import type { WeekTotal } from '../../domain/workout-trends';
import { WeekBars, WeeklyBarChart } from '../WeeklyBarChart';

const monday = (m: number, d: number) => new Date(2026, m - 1, d).toISOString();

const weeks: WeekTotal[] = [
  { weekStart: monday(10, 19), distanceMeters: 12_340, durationSeconds: 3_700, count: 2 },
  { weekStart: monday(10, 26), distanceMeters: 0, durationSeconds: 0, count: 0 },
  { weekStart: monday(11, 2), distanceMeters: 5_000, durationSeconds: 1_500, count: 1 },
];

describe('WeeklyBarChart', () => {
  it('lê cada semana com a distância e os treinos, e marca a selecionada', async () => {
    await render(<WeeklyBarChart weeks={weeks} unit="km" selected={2} onSelect={() => {}} />);
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Semana de 19/10: 12,3 quilômetros, 2 treinos',
      'Semana de 26/10: 0,0 quilômetros, 0 treinos',
      'Semana de 02/11: 5,0 quilômetros, 1 treino',
    ]);
    expect(screen.getByRole('button', { name: 'Semana de 02/11: 5,0 quilômetros, 1 treino' })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Semana de 19\/10/ })).not.toBeSelected();
  });

  it('em milhas, converte a distância e a meta', async () => {
    await render(<WeeklyBarChart weeks={weeks} unit="mi" selected={2} onSelect={() => {}} goalMeters={16_093.44} />);
    expect(screen.getByRole('button', { name: 'Semana de 02/11: 3,1 milhas, 1 treino' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Meta semanal: 10,00 milhas')).toBeOnTheScreen();
    expect(screen.getByText('Meta 10,00 mi')).toBeOnTheScreen();
  });

  it('mostra a linha da meta só quando há meta', async () => {
    const { rerender } = await render(
      <WeeklyBarChart weeks={weeks} unit="km" selected={2} onSelect={() => {}} goalMeters={20_000} />,
    );
    expect(screen.getByLabelText('Meta semanal: 20,00 quilômetros')).toBeOnTheScreen();
    expect(screen.getByText('Meta 20,00 km')).toBeOnTheScreen();

    await rerender(<WeeklyBarChart weeks={weeks} unit="km" selected={2} onSelect={() => {}} goalMeters={null} />);
    expect(screen.queryByLabelText(/^Meta semanal/)).not.toBeOnTheScreen();
  });

  it('avisa a semana tocada', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await render(<WeeklyBarChart weeks={weeks} unit="km" selected={2} onSelect={onSelect} />);
    await user.press(screen.getByRole('button', { name: /^Semana de 19\/10/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});

describe('WeekBars', () => {
  const loads = [
    { weekStart: monday(10, 26), load: 300, count: 2 },
    { weekStart: monday(11, 2), load: 450, count: 3 },
  ];

  it('usa o valor e a leitura de quem chama, com a linha de referência', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await render(
      <WeekBars
        weeks={loads}
        value={(w) => w.load}
        spokenValue={(w) => `carga ${w.load}, ${w.count} treinos`}
        selected={1}
        onSelect={onSelect}
        reference={{ value: 375, label: 'Média 375', spoken: 'Média semanal: 375' }}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Semana de 26/10: carga 300, 2 treinos',
      'Semana de 02/11: carga 450, 3 treinos',
    ]);
    expect(screen.getByRole('button', { name: /carga 450/ })).toBeSelected();
    expect(screen.getByLabelText('Média semanal: 375')).toBeOnTheScreen();
    expect(screen.getByText('Média 375')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: /carga 300/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('sem referência, não desenha a linha', async () => {
    await render(
      <WeekBars weeks={loads} value={(w) => w.load} spokenValue={(w) => `carga ${w.load}`} selected={1} onSelect={() => {}} />,
    );
    expect(screen.queryByText(/^Média/)).not.toBeOnTheScreen();
  });
});
