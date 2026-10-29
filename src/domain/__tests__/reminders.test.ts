import {
  DEFAULT_REMINDER_PREFERENCES,
  type ReminderContext,
  type ReminderPreferences,
  parseReminderPreferences,
  parseTime,
  planReminders,
} from '../reminders';
import type { Workout } from '../workout';

// Quarta-feira, 04/11/2026, 10h (horário local).
const NOW = new Date(2026, 10, 4, 10);

let seq = 0;
const workout = (date: Date, distanceMeters: number, durationSeconds = 1800): Workout => ({
  id: `w${++seq}`,
  date: date.toISOString(),
  distanceMeters,
  durationSeconds,
  terrain: 'rua',
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  deletedAt: null,
});

const ctx = (overrides: Partial<ReminderContext> = {}): ReminderContext => ({
  workouts: [],
  unit: 'km',
  weeklyGoalMeters: null,
  raceGoal: null,
  ...overrides,
});

const prefs = (overrides: Partial<ReminderPreferences> = {}): ReminderPreferences => ({
  ...DEFAULT_REMINDER_PREFERENCES,
  ...overrides,
});

const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('parseTime', () => {
  it('normaliza e valida', () => {
    expect(parseTime('7:05')).toBe('07:05');
    expect(parseTime(' 18:30 ')).toBe('18:30');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:60')).toBeNull();
    expect(parseTime('7h')).toBeNull();
  });
});

describe('parseReminderPreferences', () => {
  it('aceita o padrão e ordena os dias sem repetir', () => {
    expect(parseReminderPreferences(DEFAULT_REMINDER_PREFERENCES)).toEqual(DEFAULT_REMINDER_PREFERENCES);
    expect(parseReminderPreferences({ ...DEFAULT_REMINDER_PREFERENCES, trainingDays: [6, 2, 6] })?.trainingDays).toEqual([
      2, 6,
    ]);
  });

  it('rejeita dados inválidos', () => {
    expect(parseReminderPreferences(null)).toBeNull();
    expect(parseReminderPreferences({ ...DEFAULT_REMINDER_PREFERENCES, trainingDays: [7] })).toBeNull();
    expect(parseReminderPreferences({ ...DEFAULT_REMINDER_PREFERENCES, time: '25:00' })).toBeNull();
    expect(parseReminderPreferences({ ...DEFAULT_REMINDER_PREFERENCES, race: 'sim' })).toBeNull();
  });
});

describe('planReminders', () => {
  it('tudo desligado: nenhum lembrete', () => {
    expect(planReminders(DEFAULT_REMINDER_PREFERENCES, ctx({ weeklyGoalMeters: 20_000 }), NOW)).toEqual([]);
  });

  it('dias de treino nos próximos 14 dias, no horário escolhido', () => {
    // Terça, quinta e sábado; a terça desta semana já passou.
    const reminders = planReminders(prefs({ training: true }), ctx(), NOW);
    expect(ids(reminders)).toEqual([
      'treino:2026-11-05',
      'treino:2026-11-07',
      'treino:2026-11-10',
      'treino:2026-11-12',
      'treino:2026-11-14',
      'treino:2026-11-17',
    ]);
    expect(reminders[0].date).toEqual(new Date(2026, 10, 5, 7, 0));
    expect(reminders[0]).toMatchObject({ title: 'Dia de treino', body: expect.stringMatching(/^Hora de correr/) });
  });

  it('hoje conta se o horário ainda não passou e não houve treino', () => {
    const wednesday = prefs({ training: true, trainingDays: [3], time: '18:00' });
    expect(ids(planReminders(wednesday, ctx(), NOW))[0]).toBe('treino:2026-11-04');
    expect(ids(planReminders({ ...wednesday, time: '06:00' }, ctx(), NOW))[0]).toBe('treino:2026-11-11');

    const ranThisMorning = ctx({ workouts: [workout(new Date(2026, 10, 4, 7), 5000)] });
    expect(ids(planReminders(wednesday, ranThisMorning, NOW))[0]).toBe('treino:2026-11-11');
  });

  it('com prova-alvo, cada dia traz a sessão-chave da semana do plano', () => {
    const raceGoal = { distanceKm: 10, date: '2026-11-22' };
    const byId = new Map(
      planReminders(prefs({ training: true }), ctx({ raceGoal }), NOW).map((r) => [r.id, r.body]),
    );

    // Semana de pico: qualidade nos primeiros dias, longão no último.
    expect(byId.get('treino:2026-11-05')).toMatch(/^Intervalado: /);
    expect(byId.get('treino:2026-11-07')).toMatch(/^Longão: .* km em ritmo leve\.$/);
    // Polimento: limiar, depois corrida leve, depois longão.
    expect(byId.get('treino:2026-11-10')).toMatch(/^Limiar: /);
    expect(byId.get('treino:2026-11-12')).toBe('Corrida leve, em ritmo de conversa.');
    expect(byId.get('treino:2026-11-14')).toMatch(/^Longão: /);
    // Semana da prova.
    expect(byId.get('treino:2026-11-17')).toMatch(/^Semana da prova/);
  });

  it('o texto do plano segue a unidade preferida', () => {
    const raceGoal = { distanceKm: 10, date: '2026-11-22' };
    const [, saturday] = planReminders(prefs({ training: true }), ctx({ raceGoal, unit: 'mi' }), NOW);
    expect(saturday.body).toMatch(/^Longão: .* mi em ritmo leve\.$/);
  });

  it('não lembra de treinar no dia da prova', () => {
    const raceGoal = { distanceKm: 5, date: '2026-11-07' };
    expect(ids(planReminders(prefs({ training: true }), ctx({ raceGoal }), NOW))).not.toContain('treino:2026-11-07');
  });

  it('meta semanal: sábado às 9h com o que falta', () => {
    const reminders = planReminders(
      prefs({ weeklyGoal: true }),
      ctx({ weeklyGoalMeters: 20_000, workouts: [workout(new Date(2026, 10, 2, 7), 11_500)] }),
      NOW,
    );
    expect(reminders).toEqual([
      {
        id: 'meta:2026-11-07',
        date: new Date(2026, 10, 7, 9),
        title: 'Meta da semana',
        body: 'Faltam 8,5 km para a meta de 20 km. Ainda dá tempo até domingo!',
      },
    ]);
  });

  it('meta semanal: some quando a meta é batida, sem meta ou depois de sábado', () => {
    const on = prefs({ weeklyGoal: true });
    const done = ctx({ weeklyGoalMeters: 10_000, workouts: [workout(new Date(2026, 10, 3, 7), 10_000)] });
    expect(planReminders(on, done, NOW)).toEqual([]);
    expect(planReminders(on, ctx(), NOW)).toEqual([]);
    expect(planReminders(on, ctx({ weeklyGoalMeters: 10_000 }), new Date(2026, 10, 7, 10))).toEqual([]);
  });

  it('prova: 7 dias antes e na véspera, às 19h', () => {
    const raceGoal = { distanceKm: 21.0975, date: '2026-11-22' };
    const reminders = planReminders(prefs({ race: true }), ctx({ raceGoal }), NOW);
    expect(reminders.map((r) => [r.id, r.date])).toEqual([
      ['prova:7:2026-11-22', new Date(2026, 10, 15, 19)],
      ['prova:1:2026-11-22', new Date(2026, 10, 21, 19)],
    ]);
    expect(reminders[0].body).toMatch(/^Meia Maratona em 7 dias/);
    expect(reminders[1]).toMatchObject({ title: 'Prova amanhã', body: expect.stringMatching(/^Meia Maratona amanhã/) });
  });

  it('prova: só os lembretes que ainda não passaram, e nada sem prova', () => {
    const raceGoal = { distanceKm: 5, date: '2026-11-08' };
    expect(ids(planReminders(prefs({ race: true }), ctx({ raceGoal }), NOW))).toEqual(['prova:1:2026-11-08']);
    expect(planReminders(prefs({ race: true }), ctx({ raceGoal: { distanceKm: 5, date: '2026-10-01' } }), NOW)).toEqual([]);
    expect(planReminders(prefs({ race: true }), ctx(), NOW)).toEqual([]);
  });

  it('junta os tipos em ordem de data', () => {
    const reminders = planReminders(
      prefs({ training: true, weeklyGoal: true, race: true }),
      ctx({ weeklyGoalMeters: 20_000, raceGoal: { distanceKm: 5, date: '2026-11-08' } }),
      NOW,
    );
    const dates = reminders.map((r) => r.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    expect(ids(reminders).slice(0, 4)).toEqual([
      'treino:2026-11-05',
      'treino:2026-11-07',
      'meta:2026-11-07',
      'prova:1:2026-11-08',
    ]);
  });
});
