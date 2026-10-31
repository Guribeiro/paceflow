import { type GoalForWeek, streakLabel, weeklyStreak } from '../streak';
import type { Workout } from '../workout';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 7) => new Date(y, m - 1, d, h);

let seq = 0;
const workout = (date: Date, distanceMeters = 5_000, overrides: Partial<Workout> = {}): Workout => ({
  id: `w${++seq}`,
  date: date.toISOString(),
  distanceMeters,
  durationSeconds: 1800,
  terrain: 'rua',
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  deletedAt: null,
  ...overrides,
});

// Quarta-feira, 04/11/2026, 10h; a semana começa na segunda 02/11.
const NOW = local(2026, 11, 4, 10);

const noGoal: GoalForWeek = () => null;
const fixedGoal =
  (meters: number): GoalForWeek =>
  () =>
    meters;

describe('weeklyStreak', () => {
  it('sem treinos: nada a manter, nem em risco', () => {
    expect(weeklyStreak([], noGoal, NOW)).toEqual({
      current: 0,
      best: 0,
      currentWeekDone: false,
      atRisk: false,
      remainingMeters: null,
    });
    expect(weeklyStreak([], fixedGoal(20_000), NOW)).toEqual({
      current: 0,
      best: 0,
      currentWeekDone: false,
      atRisk: false,
      remainingMeters: 20_000,
    });
  });

  it('sem meta, cada semana com um treino conta, incluindo a atual', () => {
    const workouts = [
      workout(local(2026, 10, 14)), // semana de 12/10
      workout(local(2026, 10, 25)), // domingo, semana de 19/10
      workout(local(2026, 10, 28)), // semana de 26/10
      workout(local(2026, 11, 2)), // semana atual
    ];
    expect(weeklyStreak(workouts, noGoal, NOW)).toEqual({
      current: 4,
      best: 4,
      currentWeekDone: true,
      atRisk: false,
      remainingMeters: null,
    });
  });

  it('com meta, a semana conta pela soma dos treinos e vale exatamente a meta', () => {
    const workouts = [
      workout(local(2026, 10, 13), 20_000), // exatamente a meta
      workout(local(2026, 10, 20), 12_000),
      workout(local(2026, 10, 24), 8_000), // 12 + 8 = 20 km
      workout(local(2026, 10, 27), 25_000),
      workout(local(2026, 11, 3), 20_000), // semana atual garantida
    ];
    expect(weeklyStreak(workouts, fixedGoal(20_000), NOW)).toEqual({
      current: 4,
      best: 4,
      currentWeekDone: true,
      atRisk: false,
      remainingMeters: null,
    });
  });

  it('com meta, uma semana abaixo dela quebra a sequência', () => {
    const workouts = [
      workout(local(2026, 10, 13), 20_000),
      workout(local(2026, 10, 20), 19_999), // faltou 1 m
      workout(local(2026, 10, 27), 20_000),
    ];
    expect(weeklyStreak(workouts, fixedGoal(20_000), NOW)).toMatchObject({ current: 1, best: 1 });
  });

  it('a semana atual em aberto não quebra a sequência e fica em risco', () => {
    const workouts = [workout(local(2026, 10, 20)), workout(local(2026, 10, 27))];
    expect(weeklyStreak(workouts, noGoal, NOW)).toEqual({
      current: 2,
      best: 2,
      currentWeekDone: false,
      atRisk: true,
      remainingMeters: null, // sem meta, basta uma corrida
    });
  });

  it('semana atual com treino, mas abaixo da meta: em risco com o que falta', () => {
    const workouts = [workout(local(2026, 10, 27), 20_000), workout(local(2026, 11, 2), 12_500)];
    expect(weeklyStreak(workouts, fixedGoal(20_000), NOW)).toEqual({
      current: 1,
      best: 1,
      currentWeekDone: false,
      atRisk: true,
      remainingMeters: 7_500,
    });
  });

  it('sem sequência, a semana atual pendente não está em risco', () => {
    // A última semana com treino é a de 12/10; a de 19/10 ficou vazia.
    const streak = weeklyStreak([workout(local(2026, 10, 14))], fixedGoal(10_000), NOW);
    expect(streak).toEqual({ current: 0, best: 0, currentWeekDone: false, atRisk: false, remainingMeters: 10_000 });
  });

  it('uma semana vazia zera a sequência atual, mas a melhor fica', () => {
    const workouts = [
      workout(local(2026, 9, 28)),
      workout(local(2026, 10, 6)),
      workout(local(2026, 10, 13)), // três seguidas: 28/09, 05/10, 12/10
      // semana de 19/10 sem treino
      workout(local(2026, 10, 27)),
    ];
    expect(weeklyStreak(workouts, noGoal, NOW)).toMatchObject({ current: 1, best: 3, atRisk: true });
  });

  it('a melhor sequência pode ser a atual, contando a semana em curso', () => {
    const workouts = [
      workout(local(2026, 10, 6)),
      // semana de 12/10 sem treino
      workout(local(2026, 10, 20)),
      workout(local(2026, 10, 27)),
      workout(local(2026, 11, 3)),
    ];
    expect(weeklyStreak(workouts, noGoal, NOW)).toMatchObject({ current: 3, best: 3 });
  });

  it('a ordem dos treinos não importa', () => {
    const workouts = [workout(local(2026, 10, 27)), workout(local(2026, 10, 13)), workout(local(2026, 10, 20))];
    expect(weeklyStreak(workouts, noGoal, NOW)).toMatchObject({ current: 3, best: 3 });
  });

  it('cada semana usa a meta que valia nela, consultada pela segunda (AAAA-MM-DD)', () => {
    // 10 km até a semana de 12/10, 20 km a partir de 19/10, sem meta na semana atual.
    const goals: Record<string, number | null> = { '2026-10-19': 20_000, '2026-10-26': 20_000, '2026-11-02': null };
    const goalForWeek = jest.fn((week: string) => (week in goals ? goals[week] : 10_000));
    const workouts = [
      workout(local(2026, 10, 7), 12_000), // conta (meta 10 km)
      workout(local(2026, 10, 14), 12_000), // conta (meta 10 km)
      workout(local(2026, 10, 21), 21_000), // conta (meta 20 km)
      workout(local(2026, 10, 28), 15_000), // não conta (meta 20 km)
      workout(local(2026, 11, 3), 1_000), // conta: sem meta, basta um treino
    ];
    expect(weeklyStreak(workouts, goalForWeek, NOW)).toMatchObject({ current: 1, best: 3, currentWeekDone: true });
    expect(new Set(goalForWeek.mock.calls.map(([week]) => week))).toEqual(
      new Set(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']),
    );
  });

  it('com a meta de hoje aplicada ao passado, a mesma distância daria outro resultado', () => {
    const workouts = [workout(local(2026, 10, 14), 12_000), workout(local(2026, 10, 21), 12_000)];
    const history: GoalForWeek = (week) => (week < '2026-10-26' ? 10_000 : 20_000);
    expect(weeklyStreak(workouts, history, NOW)).toMatchObject({ current: 0, best: 2 });
    expect(weeklyStreak(workouts, fixedGoal(20_000), NOW)).toMatchObject({ current: 0, best: 0 });
  });

  it('ignora treinos excluídos', () => {
    const deleted = { deletedAt: NOW.toISOString() };
    const workouts = [
      workout(local(2026, 10, 20)),
      workout(local(2026, 10, 27), 5_000, deleted), // a semana de 26/10 fica vazia
      workout(local(2026, 11, 3), 5_000, deleted),
    ];
    expect(weeklyStreak(workouts, noGoal, NOW)).toEqual({
      current: 0,
      best: 1,
      currentWeekDone: false,
      atRisk: false,
      remainingMeters: null,
    });
  });

  it('treino excluído não soma para a meta', () => {
    const workouts = [
      workout(local(2026, 11, 2), 10_000),
      workout(local(2026, 11, 3), 10_000, { deletedAt: NOW.toISOString() }),
    ];
    expect(weeklyStreak(workouts, fixedGoal(20_000), NOW)).toMatchObject({
      currentWeekDone: false,
      remainingMeters: 10_000,
    });
  });

  it('ignora treinos no futuro, mesmo mais tarde no mesmo dia', () => {
    const workouts = [
      workout(local(2026, 10, 27)),
      workout(local(2026, 11, 4, 18)), // hoje às 18h, ainda não aconteceu
      workout(local(2026, 11, 10)), // semana que vem
    ];
    expect(weeklyStreak(workouts, noGoal, NOW)).toMatchObject({ current: 1, best: 1, currentWeekDone: false, atRisk: true });
  });

  it('domingo à noite fecha a semana; segunda de madrugada já é a seguinte', () => {
    const sundayNight = [workout(local(2026, 10, 25, 23)), workout(local(2026, 11, 1, 23))];
    expect(weeklyStreak(sundayNight, noGoal, NOW)).toMatchObject({ current: 2, currentWeekDone: false });

    const mondayDawn = [workout(local(2026, 10, 26, 0)), workout(local(2026, 11, 2, 0))];
    expect(weeklyStreak(mondayDawn, noGoal, NOW)).toMatchObject({ current: 2, currentWeekDone: true });
  });

  describe('horário de verão', () => {
    // Conta as semanas pelo calendário: somar 7×24h desalinha a segunda ao
    // atravessar o fim do horário de verão (o relógio volta uma hora).
    // Só distingue os dois jeitos num fuso com horário de verão nas datas
    // abaixo; rode também com TZ=America/New_York ou TZ=Europe/Berlin.
    it('atravessa o fim do horário de verão de 2026 (EUA 01/11, Europa 25/10)', () => {
      const workouts = [];
      for (let d = local(2026, 9, 9); d <= NOW; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
        workouts.push(workout(d));
      }
      expect(workouts).toHaveLength(9);
      expect(weeklyStreak(workouts, noGoal, NOW)).toMatchObject({ current: 9, best: 9, currentWeekDone: true });
    });

    it('atravessa o fim do horário de verão brasileiro de 2019 (17/02)', () => {
      const now = local(2019, 3, 6, 10);
      const workouts = [];
      for (let d = local(2019, 1, 9); d <= now; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
        workouts.push(workout(d));
      }
      expect(workouts).toHaveLength(9);
      expect(weeklyStreak(workouts, noGoal, now)).toMatchObject({ current: 9, best: 9, currentWeekDone: true });
    });

    it('atravessa o início do horário de verão brasileiro de 2018 (domingo 04/11, sem meia-noite)', () => {
      const now = local(2018, 11, 14, 10);
      const workouts = [workout(local(2018, 10, 29)), workout(local(2018, 11, 4, 12)), workout(local(2018, 11, 6))];
      // 29/10 e 04/11 caem na mesma semana; 06/11 é a seguinte.
      expect(weeklyStreak(workouts, noGoal, now)).toMatchObject({ current: 2, best: 2, currentWeekDone: false, atRisk: true });
    });
  });
});

describe('streakLabel', () => {
  it('usa singular só para uma semana', () => {
    expect([0, 1, 2, 12].map(streakLabel)).toEqual(['0 semanas', '1 semana', '2 semanas', '12 semanas']);
  });
});
