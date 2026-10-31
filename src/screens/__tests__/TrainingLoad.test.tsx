import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { storage } from '../../data/storage/mmkv';
import { workoutRepository } from '../../data/workouts';
import { CalculatorScreen } from '../CalculatorScreen';
import { TrendsScreen } from '../TrendsScreen';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

// Datas relativas ao relógio real: meio-dia de `n` dias atrás (sempre no passado).
function daysAgo(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12);
}

// Carga = RPE × minutos; com RPE 5, 30 min dão 150.
function add(date: Date, minutes = 30, rpe: number | null = 5) {
  const result = workoutRepository.create({
    date: date.toISOString(),
    distanceMeters: 5_000,
    durationSeconds: minutes * 60,
    terrain: 'rua',
    rpe: rpe ?? undefined,
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** Três semanas de 150 antes da semana atual: histórico suficiente e média estável. */
function history() {
  add(daysAgo(25));
  add(daysAgo(18));
  add(daysAgo(11));
}

// O MMKV mock é compartilhado pelos testes do arquivo: cada teste começa
// com o diário vazio e sem meta.
beforeEach(() => {
  for (const w of workoutRepository.list()) workoutRepository.remove(w.id);
  preferencesRepository.setUnit('km');
  preferencesRepository.setWeeklyGoal(null);
  storage.remove('prefs:v1:weeklyGoalHistory');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Carga de treino na Evolução', () => {
  it('com menos de 3 semanas de histórico, pede mais treinos', async () => {
    add(daysAgo(10));
    add(daysAgo(1), 90);
    await render(<TrendsScreen />);
    expect(
      screen.getByText('Registre treinos por 3 semanas para comparar sua carga recente com a sua média.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Carga de treino:/)).not.toBeOnTheScreen();
  });

  it('com histórico, mostra a zona, os números, o conselho e a média no gráfico', async () => {
    history();
    add(daysAgo(2));
    await render(<TrendsScreen />);

    expect(
      screen.getByLabelText(
        'Carga de treino: Na medida. Últimos 7 dias: 150, média semanal: 150, 1,0 vezes. ' +
          'Carga parecida com a sua média: bom ritmo para evoluir sem se machucar.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Últimos 7 dias: 150 · média semanal: 150 (1,0×)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Média semanal das últimas 4 semanas: 150')).toBeOnTheScreen();
    expect(screen.getByText('Média 150')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Semana de \d{2}\/\d{2}: carga / })).toHaveLength(12);
    expect(screen.getByText('Carga = esforço (RPE) × minutos. É uma estimativa, não orientação médica.')).toBeOnTheScreen();
  });

  it('acima da média, mostra o risco de lesão', async () => {
    history();
    add(daysAgo(1), 90); // 450: 7 dias = 450, média = 900 ÷ 4 = 225
    await render(<TrendsScreen />);
    expect(screen.getByLabelText(/^Carga de treino: Risco de lesão\. Últimos 7 dias: 450, média semanal: 225, 2,0 vezes\./)).toBeOnTheScreen();
    expect(screen.getByText('Últimos 7 dias: 450 · média semanal: 225 (2,0×)')).toBeOnTheScreen();
  });

  it('avisa quantos treinos sem RPE usaram a média', async () => {
    add(daysAgo(25), 30, 4);
    add(daysAgo(18), 30, 7);
    add(daysAgo(11), 30, null);
    add(daysAgo(2), 30, null);
    await render(<TrendsScreen />);
    expect(
      screen.getByText(
        'Carga = esforço (RPE) × minutos. 2 treinos sem RPE usaram sua média (5,5). É uma estimativa, não orientação médica.',
      ),
    ).toBeOnTheScreen();
  });

  it('tocar numa barra mostra a carga daquela semana', async () => {
    history();
    add(daysAgo(2));
    const user = userEvent.setup();
    await render(<TrendsScreen />);
    const bars = screen.getAllByRole('button', { name: /: carga / });
    // Uma semana passada com um treino de 150 (a atual é a última barra).
    const week = bars.findIndex((b, i) => i < 11 && /carga 150, 1 treino$/.test(b.props.accessibilityLabel));
    await user.press(bars[week]);
    expect(bars[week]).toBeSelected();
    expect(screen.getByText(/^Semana de \d{2}\/\d{2}: 150$/)).toBeOnTheScreen();
  });
});

describe('Aviso de carga no Diário', () => {
  it('não aparece com a carga na medida', async () => {
    history();
    add(daysAgo(2));
    await render(<WorkoutLogScreen />);
    expect(screen.queryByText(/a carga dos últimos 7 dias é/)).not.toBeOnTheScreen();
  });

  it('não aparece sem histórico suficiente, mesmo com carga alta', async () => {
    add(daysAgo(10));
    add(daysAgo(1), 180);
    await render(<WorkoutLogScreen />);
    expect(screen.queryByText(/a carga dos últimos 7 dias é/)).not.toBeOnTheScreen();
  });

  it('em atenção, avisa que a carga está subindo', async () => {
    history();
    add(daysAgo(1), 49); // 245: 245 ÷ (695 ÷ 4) ≈ 1,41
    await render(<WorkoutLogScreen />);
    expect(screen.getByRole('header', { name: 'Carga de treino' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Subindo rápido: a carga dos últimos 7 dias é 1,4× a sua média semanal. Um dia leve ou de descanso ajuda a evitar lesão.',
      ),
    ).toBeOnTheScreen();
  });

  it('em alta, avisa o risco e some ao excluir o treino que subiu a carga', async () => {
    history();
    const heavy = add(daysAgo(1), 90);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Excluir')?.onPress?.();
    });
    const user = userEvent.setup();
    await render(<WorkoutLogScreen />);
    expect(
      screen.getByText(
        'Risco de lesão: a carga dos últimos 7 dias é 2,0× a sua média semanal. Um dia leve ou de descanso ajuda a evitar lesão.',
      ),
    ).toBeOnTheScreen();

    // O mais recente vem primeiro no histórico.
    await user.press(screen.getAllByRole('button', { name: 'Excluir treino' })[0]);

    expect(workoutRepository.getById(heavy.id)).toBeUndefined();
    expect(screen.queryByText(/a carga dos últimos 7 dias é/)).not.toBeOnTheScreen();
  });
});

describe('Aviso de carga ao salvar', () => {
  async function save(user: ReturnType<typeof userEvent.setup>, rpe?: number) {
    await user.type(screen.getByLabelText(/^Distância/), '3');
    await user.type(screen.getByLabelText('Tempo'), '30:00');
    await user.press(screen.getByRole('radio', { name: 'Rua' }));
    if (rpe !== undefined) await user.press(screen.getByRole('radio', { name: `esforço ${rpe}` }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
  }

  it('avisa quando o treino leva a carga para a zona alta, e só na entrada', async () => {
    history();
    const user = userEvent.setup();
    await render(<CalculatorScreen />);

    // 10 × 30 = 300; média = 750 ÷ 4 = 187,5; 1,6×.
    await save(user, 10);
    expect(
      screen.getByText(/^✓ Treino salvo no diário .*⚠️ Carga alta: 1,6× sua média semanal\. Pegue leve nos próximos dias\.$/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Treino salvo no diário\. .*Carga alta: 1,6 vezes sua média semanal\. Pegue leve nos próximos dias\.$/),
    ).toBeOnTheScreen();

    // Já em risco: o treino seguinte salva sem repetir o aviso.
    await user.clear(screen.getByLabelText('Tempo'));
    await user.type(screen.getByLabelText('Tempo'), '31:00');
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(screen.getByText('✓ Treino salvo no diário')).toBeOnTheScreen();
    expect(workoutRepository.list()).toHaveLength(5);
  });

  it('com a carga na medida, não avisa', async () => {
    history();
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await save(user, 5);
    expect(screen.getByText(/^✓ Treino salvo no diário/)).toBeOnTheScreen();
    expect(screen.queryByText(/Carga/)).not.toBeOnTheScreen();
  });
});

describe('Virada do dia com o app aberto', () => {
  // Quarta, 04/11/2026, 23:59:30 (horário local). Fake timers só aqui: o
  // relógio precisa andar até quinta sem mudar os treinos.
  const LATE_NIGHT = new Date(2026, 10, 4, 23, 59, 30);

  beforeEach(() => {
    jest.useFakeTimers({ now: LATE_NIGHT });
    add(new Date(2026, 9, 10, 8));
    add(new Date(2026, 9, 17, 8));
    add(new Date(2026, 9, 24, 8));
    // 6 dias atrás: sai dos últimos 7 dias à meia-noite.
    add(new Date(2026, 9, 29, 8), 90);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function nextMinute() {
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
  }

  it('no Diário, o aviso some quando o treino pesado sai da janela', async () => {
    await render(<WorkoutLogScreen />);
    expect(screen.getByText(/^Risco de lesão: a carga dos últimos 7 dias é 2,0×/)).toBeOnTheScreen();

    await nextMinute();

    expect(screen.queryByText(/a carga dos últimos 7 dias é/)).not.toBeOnTheScreen();
  });

  it('na Evolução, a carga dos últimos 7 dias zera', async () => {
    await render(<TrendsScreen />);
    expect(screen.getByText('Últimos 7 dias: 450 · média semanal: 225 (2,0×)')).toBeOnTheScreen();

    await nextMinute();

    expect(screen.getByText('Últimos 7 dias: 0 · média semanal: 225 (0,0×)')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Carga de treino: Abaixo do habitual\./)).toBeOnTheScreen();
  });
});
