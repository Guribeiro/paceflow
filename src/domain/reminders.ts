import { type DistanceUnit, distanceInUnit } from './pace/units';
import type { RaceGoal } from './race-goal';
import { type KeySession, buildTrainingPlan, raceName } from './training-plan';
import { goalProgress } from './weekly-goal';
import type { Workout } from './workout';
import { startOfWeek, summarizeWeek } from './workout-summary';

/** Preferências dos lembretes; ficam no aparelho, como o tema. */
export interface ReminderPreferences {
  training: boolean;
  /** Dias de treino, como Date.getDay(): 0 = domingo … 6 = sábado. */
  trainingDays: number[];
  /** Horário dos lembretes de treino, "HH:MM". */
  time: string;
  weeklyGoal: boolean;
  race: boolean;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  training: false,
  trainingDays: [2, 4, 6],
  time: '07:00',
  weeklyGoal: false,
  race: false,
};

export interface Reminder {
  /** Determinístico (tipo + data), para reagendar sem duplicar. */
  id: string;
  date: Date;
  title: string;
  body: string;
}

export interface ReminderContext {
  workouts: readonly Workout[];
  unit: DistanceUnit;
  weeklyGoalMeters: number | null;
  raceGoal: RaceGoal | null;
}

/** Lembretes de treino cobrem só os próximos dias; o app reagenda ao abrir. */
const HORIZON_DAYS = 14;
const GOAL_REMINDER = { weekday: 5, hour: 9 }; // sábado, a partir da segunda
const RACE_REMINDER_HOUR = 19;
const RACE_OFFSETS = [7, 1];

const TIME = /^(\d{1,2}):(\d{2})$/;

/** "7:05" → "07:05"; null se não for um horário válido. */
export function parseTime(input: string): string | null {
  const match = TIME.exec(input.trim());
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

export function parseReminderPreferences(value: unknown): ReminderPreferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  const days = Array.isArray(p.trainingDays) ? p.trainingDays : null;
  const daysOk = days !== null && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const time = typeof p.time === 'string' ? parseTime(p.time) : null;
  if (typeof p.training !== 'boolean' || typeof p.weeklyGoal !== 'boolean' || typeof p.race !== 'boolean') return null;
  if (!daysOk || time === null) return null;
  return {
    training: p.training,
    trainingDays: [...new Set(days as number[])].sort((a, b) => a - b),
    time,
    weeklyGoal: p.weeklyGoal,
    race: p.race,
  };
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const at = (day: Date, hour: number, minute = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);

const shortDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

/** Segunda primeiro: o longão fica para o último dia de treino da semana. */
const mondayFirst = (weekday: number) => (weekday + 6) % 7;

const sessionText = (s: KeySession) => `${s.title}: ${s.detail}.`;

/**
 * Sessão-chave de cada dia de treino da semana: os treinos de qualidade vão
 * para os primeiros dias e o longão (ou o longão com ritmo de prova) para o
 * último; dias a mais ficam com corrida leve.
 */
function sessionsByWeekday(sessions: readonly KeySession[], weekdays: readonly number[]): Map<number, string> {
  const ordered = [...weekdays].sort((a, b) => mondayFirst(a) - mondayFirst(b));
  const long = sessions.find((s) => s.kind === 'racePace') ?? sessions.find((s) => s.kind === 'long');
  const quality = sessions.filter((s) => s.kind === 'threshold' || s.kind === 'interval');
  const result = new Map<number, string>();
  ordered.forEach((weekday, i) => {
    const last = i === ordered.length - 1;
    if (last && long) result.set(weekday, sessionText(long));
    else if (i < quality.length) result.set(weekday, sessionText(quality[i]));
    else result.set(weekday, 'Corrida leve, em ritmo de conversa.');
  });
  return result;
}

function trainingReminders(prefs: ReminderPreferences, ctx: ReminderContext, now: Date): Reminder[] {
  const [hour, minute] = prefs.time.split(':').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plan = ctx.raceGoal ? buildTrainingPlan(ctx.raceGoal, ctx.workouts, now, ctx.unit) : null;
  const raceDay = ctx.raceGoal?.date;
  const ranToday = ctx.workouts.some((w) => w.deletedAt === null && dateKey(new Date(w.date)) === dateKey(today));

  const reminders: Reminder[] = [];
  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const day = addDays(today, offset);
    const date = at(day, hour, minute);
    const key = dateKey(day);
    if (!prefs.trainingDays.includes(day.getDay()) || date <= now) continue;
    if (offset === 0 && ranToday) continue;
    if (key === raceDay) continue; // no dia da prova, o lembrete é a véspera

    const week = plan?.weeks.find((w) => dateKey(new Date(w.weekStart)) === dateKey(startOfWeek(day)));
    let body = 'Hora de correr! Depois, registre o treino no PaceFlow.';
    if (week?.isRaceWeek && raceDay && key < raceDay) {
      body = 'Semana da prova: corrida leve e curta, para chegar com as pernas descansadas.';
    } else if (week && !week.isRaceWeek) {
      body = sessionsByWeekday(week.sessions, prefs.trainingDays).get(day.getDay()) ?? body;
    }
    reminders.push({ id: `treino:${key}`, date, title: 'Dia de treino', body });
  }
  return reminders;
}

function weeklyGoalReminder(ctx: ReminderContext, now: Date): Reminder[] {
  if (ctx.weeklyGoalMeters === null) return [];
  const saturday = addDays(startOfWeek(now), GOAL_REMINDER.weekday);
  const date = at(saturday, GOAL_REMINDER.hour);
  const progress = goalProgress(summarizeWeek(ctx.workouts, now).distanceMeters, ctx.weeklyGoalMeters);
  if (date <= now || progress.reached) return [];
  // Uma casa decimal, sem ",0": "8 km", "32,5 km".
  const short = (meters: number) =>
    `${String(Number(distanceInUnit(meters, ctx.unit).toFixed(1))).replace('.', ',')} ${ctx.unit}`;
  const remaining = short(progress.remainingMeters);
  const goal = short(ctx.weeklyGoalMeters);
  return [
    {
      id: `meta:${dateKey(saturday)}`,
      date,
      title: 'Meta da semana',
      body: `Faltam ${remaining} para a meta de ${goal}. Ainda dá tempo até domingo!`,
    },
  ];
}

function raceReminders(goal: RaceGoal, now: Date): Reminder[] {
  const [y, m, d] = goal.date.split('-').map(Number);
  const race = new Date(y, m - 1, d);
  const name = raceName(goal.distanceKm);
  return RACE_OFFSETS.flatMap((daysBefore) => {
    const date = at(addDays(race, -daysBefore), RACE_REMINDER_HOUR);
    if (date <= now) return [];
    const body =
      daysBefore === 1
        ? `${name} amanhã. Descanse, hidrate-se e deixe o equipamento separado hoje.`
        : `${name} em ${daysBefore} dias (${shortDate.format(race)}). Semana de polimento: menos volume, mais descanso.`;
    return [
      {
        id: `prova:${daysBefore}:${goal.date}`,
        date,
        title: daysBefore === 1 ? 'Prova amanhã' : `Prova em ${daysBefore} dias`,
        body,
      },
    ];
  });
}

/** Lembretes desejados a partir de agora, em ordem de data. */
export function planReminders(prefs: ReminderPreferences, ctx: ReminderContext, now: Date = new Date()): Reminder[] {
  const reminders = [
    ...(prefs.training ? trainingReminders(prefs, ctx, now) : []),
    ...(prefs.weeklyGoal ? weeklyGoalReminder(ctx, now) : []),
    ...(prefs.race && ctx.raceGoal ? raceReminders(ctx.raceGoal, now) : []),
  ];
  return reminders.sort((a, b) => a.date.getTime() - b.date.getTime());
}
