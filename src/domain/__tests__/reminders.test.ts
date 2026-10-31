import {
  DEFAULT_REMINDER_PREFERENCES,
  type ReminderContext,
  type ReminderPreferences,
  parseReminderPreferences,
  parseTime,
  planReminders,
} from '../reminders';
import { KM_PER_MILE } from '../pace/units';
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
    expect(parseReminderPreferences({ ...DEFAULT_REMINDER_PREFERENCES, streak: 'sim' })).toBeNull();
  });

  it('preferências gravadas antes da sequência continuam válidas, com ela desligada', () => {
    const { streak: _streak, ...old } = { ...DEFAULT_REMINDER_PREFERENCES, training: true, trainingDays: [1] };
    expect(parseReminderPreferences(old)).toEqual({ ...old, streak: false });
    expect(parseReminderPreferences({ ...old, streak: true })?.streak).toBe(true);
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

  describe('o que falta arredonda para cima, com uma casa decimal', () => {
    const on = prefs({ weeklyGoal: true, streak: true });
    // Meta em milhas, gravada em metros como o app grava: n × 1,609344 × 1000.
    const miles = (n: number) => n * KM_PER_MILE * 1000;
    // Semana de 26/10 cumprida (mantém a sequência); a atual (02/11) com `meters`.
    const week = (meters: number, goal: number) => [
      workout(new Date(2026, 9, 28, 7), goal),
      workout(new Date(2026, 10, 2, 7), meters),
    ];
    const bodies = (meters: number, goal: number, unit: 'km' | 'mi' = 'km') =>
      planReminders(on, ctx({ weeklyGoalMeters: goal, workouts: week(meters, goal), unit }), NOW).map((r) => [
        r.title,
        r.body,
      ]);

    it('faltando 30 m, diz "0,1 km" nos dois lembretes, nunca "0 km"', () => {
      expect(bodies(19_970, 20_000)).toEqual([
        ['Meta da semana', 'Faltam 0,1 km para a meta de 20 km. Ainda dá tempo até domingo!'],
        ['Sequência em risco', 'Sua sequência de 1 semana termina hoje. Faltam 0,1 km para mantê-la.'],
      ]);
    });

    it('faltando exatamente 4 km, diz "4 km", sem ",0"', () => {
      expect(bodies(16_000, 20_000)).toEqual([
        ['Meta da semana', 'Faltam 4 km para a meta de 20 km. Ainda dá tempo até domingo!'],
        ['Sequência em risco', 'Sua sequência de 1 semana termina hoje. Faltam 4 km para mantê-la.'],
      ]);
    });

    it('faltando 3,84 km, sobe para "3,9 km"', () => {
      expect(bodies(16_160, 20_000)).toEqual([
        ['Meta da semana', 'Faltam 3,9 km para a meta de 20 km. Ainda dá tempo até domingo!'],
        ['Sequência em risco', 'Sua sequência de 1 semana termina hoje. Faltam 3,9 km para mantê-la.'],
      ]);
    });

    it('em milhas: faltando poucos metros diz "0,1 mi"', () => {
      expect(bodies(miles(20) - 30, miles(20), 'mi')).toEqual([
        ['Meta da semana', 'Faltam 0,1 mi para a meta de 20 mi. Ainda dá tempo até domingo!'],
        ['Sequência em risco', 'Sua sequência de 1 semana termina hoje. Faltam 0,1 mi para mantê-la.'],
      ]);
    });

    it('em milhas: faltando exatamente 4 mi não vira "4,1 mi" por erro de ponto flutuante', () => {
      // 14 mi − 10 mi em metros dá 4,00000000000001 mi.
      expect(bodies(miles(10), miles(14), 'mi')).toEqual([
        ['Meta da semana', 'Faltam 4 mi para a meta de 14 mi. Ainda dá tempo até domingo!'],
        ['Sequência em risco', 'Sua sequência de 1 semana termina hoje. Faltam 4 mi para mantê-la.'],
      ]);
    });

    it('a meta em si usa o arredondamento normal', () => {
      const meta = (goal: number) =>
        planReminders(
          prefs({ weeklyGoal: true }),
          ctx({ weeklyGoalMeters: goal, workouts: [workout(new Date(2026, 10, 2, 7), 10_000)] }),
          NOW,
        )[0].body;
      expect(meta(32_500)).toBe('Faltam 22,5 km para a meta de 32,5 km. Ainda dá tempo até domingo!');
      // 32,54 km: a meta arredonda para 32,5; o que falta (22,54) sobe para 22,6.
      expect(meta(32_540)).toBe('Faltam 22,6 km para a meta de 32,5 km. Ainda dá tempo até domingo!');
    });
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

  describe('sequência', () => {
    const on = prefs({ streak: true });
    // Semanas de 19/10 e 26/10 com treino; a atual (02/11) ainda sem nada.
    const twoWeeks = [workout(new Date(2026, 9, 21, 7), 5_000), workout(new Date(2026, 9, 28, 7), 5_000)];

    it('em risco: domingo às 18h, e sem meta basta uma corrida', () => {
      expect(planReminders(on, ctx({ workouts: twoWeeks }), NOW)).toEqual([
        {
          id: 'sequencia:2026-11-08',
          date: new Date(2026, 10, 8, 18),
          title: 'Sequência em risco',
          body: 'Sua sequência de 2 semanas termina hoje. Uma corrida mantém a sequência.',
        },
      ]);
    });

    it('com meta, diz quanto falta na unidade preferida', () => {
      const workouts = [workout(new Date(2026, 9, 28, 7), 20_000), workout(new Date(2026, 10, 2, 7), 12_500)];
      expect(planReminders(on, ctx({ weeklyGoalMeters: 20_000, workouts }), NOW)[0].body).toBe(
        'Sua sequência de 1 semana termina hoje. Faltam 7,5 km para mantê-la.',
      );
      expect(planReminders(on, ctx({ weeklyGoalMeters: 20_000, workouts, unit: 'mi' }), NOW)[0].body).toBe(
        'Sua sequência de 1 semana termina hoje. Faltam 4,7 mi para mantê-la.',
      );
    });

    it('usa a meta que valia em cada semana', () => {
      // 12 km bastavam na semana de 26/10 (meta 10 km); a meta atual (20 km) não vale para trás.
      const workouts = [workout(new Date(2026, 9, 28, 7), 12_000)];
      const goalHistory = [
        { week: '0000-01-01', meters: 10_000 },
        { week: '2026-11-02', meters: 20_000 },
      ];
      expect(ids(planReminders(on, ctx({ weeklyGoalMeters: 20_000, workouts, goalHistory }), NOW))).toEqual([
        'sequencia:2026-11-08',
      ]);
      expect(planReminders(on, ctx({ weeklyGoalMeters: 20_000, workouts }), NOW)).toEqual([]);
    });

    it('nada sem risco: semana garantida, sem sequência ou lembrete desligado', () => {
      const done = [...twoWeeks, workout(new Date(2026, 10, 3, 7), 5_000)];
      expect(planReminders(on, ctx({ workouts: done }), NOW)).toEqual([]);
      expect(planReminders(on, ctx(), NOW)).toEqual([]);
      expect(planReminders(prefs({ streak: false }), ctx({ workouts: twoWeeks }), NOW)).toEqual([]);
    });

    it('domingo: até antes das 18h ainda lembra; das 18h em diante, não', () => {
      expect(ids(planReminders(on, ctx({ workouts: twoWeeks }), new Date(2026, 10, 8, 17, 59)))).toEqual([
        'sequencia:2026-11-08',
      ]);
      expect(planReminders(on, ctx({ workouts: twoWeeks }), new Date(2026, 10, 8, 18))).toEqual([]);
      expect(planReminders(on, ctx({ workouts: twoWeeks }), new Date(2026, 10, 8, 21))).toEqual([]);
    });
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
