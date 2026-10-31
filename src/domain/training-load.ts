import type { Workout } from './workout';
import { startOfWeek } from './workout-summary';

/** RPE usado quando ninguém informou nenhum. */
const NEUTRAL_RPE = 5;
/** Histórico mínimo para a média das 4 semanas fazer sentido. */
const MIN_HISTORY_DAYS = 21;

export type LoadZone = 'insuficiente' | 'baixa' | 'ideal' | 'atencao' | 'alta';

export interface LoadStatus {
  /** Carga dos últimos 7 dias (hoje incluso). */
  acute: number;
  /** Média semanal dos últimos 28 dias. */
  chronic: number;
  /** acute ÷ chronic; null sem histórico suficiente. */
  ratio: number | null;
  zone: LoadZone;
  /** Treinos dos últimos 28 dias sem RPE, que usaram `fallbackRpe`. */
  estimated: number;
  fallbackRpe: number;
}

export interface WeekLoad {
  /** Segunda-feira 00:00 local, em ISO. */
  weekStart: string;
  load: number;
  count: number;
}

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Treinos que contam: ativos e até agora. */
const counted = (workouts: readonly Workout[], now: Date) =>
  workouts.filter((w) => w.deletedAt === null && Date.parse(w.date) <= now.getTime());

/** Média dos RPEs informados, com uma casa; 5 se nenhum treino tem RPE. */
export function defaultRpe(workouts: readonly Workout[]): number {
  const rpes = workouts.filter((w) => w.deletedAt === null && w.rpe !== undefined).map((w) => w.rpe as number);
  if (rpes.length === 0) return NEUTRAL_RPE;
  return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
}

/** Carga do treino (sRPE): esforço × minutos. */
export function sessionLoad(workout: Workout, fallbackRpe: number): number {
  return (workout.rpe ?? fallbackRpe) * (workout.durationSeconds / 60);
}

/**
 * Faixas do ACWR (Gabbett, 2016): 0,8–1,3 é a faixa segura; acima de 1,5 o
 * risco de lesão sobe bastante.
 */
export function loadZone(ratio: number): Exclude<LoadZone, 'insuficiente'> {
  if (ratio < 0.8) return 'baixa';
  if (ratio <= 1.3) return 'ideal';
  if (ratio <= 1.5) return 'atencao';
  return 'alta';
}

/**
 * Carga dos últimos 7 dias comparada com a média semanal dos últimos 28. As
 * janelas seguem o calendário local, não 24h em ms, por causa do horário de verão.
 */
export function loadStatus(workouts: readonly Workout[], now: Date = new Date()): LoadStatus {
  const active = counted(workouts, now);
  const fallbackRpe = defaultRpe(active);
  const today = startOfDay(now);
  const start7 = addDays(today, -6).getTime();
  const start28 = addDays(today, -27).getTime();

  let acute = 0;
  let total28 = 0;
  let estimated = 0;
  let first = Infinity;
  for (const w of active) {
    const time = Date.parse(w.date);
    first = Math.min(first, time);
    if (time < start28) continue;
    const load = sessionLoad(w, fallbackRpe);
    total28 += load;
    if (w.rpe === undefined) estimated += 1;
    if (time >= start7) acute += load;
  }
  const chronic = total28 / 4;

  // Pelo dia do calendário, como as janelas: qualquer hora de 21 dias atrás vale.
  const enoughHistory = first < addDays(today, -(MIN_HISTORY_DAYS - 1)).getTime();
  const ratio = enoughHistory && chronic > 0 ? acute / chronic : null;
  return { acute, chronic, ratio, zone: ratio === null ? 'insuficiente' : loadZone(ratio), estimated, fallbackRpe };
}

/** Carga das últimas `weeks` semanas (segunda a domingo), da mais antiga à atual. */
export function weeklyLoads(workouts: readonly Workout[], now: Date = new Date(), weeks = 12): WeekLoad[] {
  const active = counted(workouts, now);
  const fallbackRpe = defaultRpe(active);
  const current = startOfWeek(now);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
  const loads = starts.map((start) => ({ weekStart: start.toISOString(), load: 0, count: 0 }));
  const first = starts[0].getTime();

  for (const w of active) {
    const time = Date.parse(w.date);
    if (time < first) continue;
    // A última semana que começa até o treino.
    let index = starts.length - 1;
    while (starts[index].getTime() > time) index -= 1;
    loads[index].load += sessionLoad(w, fallbackRpe);
    loads[index].count += 1;
  }
  return loads;
}

const isRisk = (zone: LoadZone) => zone === 'atencao' || zone === 'alta';

/** "1,6×" */
export const formatRatio = (ratio: number) => `${ratio.toFixed(1).replace('.', ',')}×`;

/** Aviso ao salvar: só quando o treino leva a carga para a zona de risco. */
export function loadMessage(before: LoadStatus, after: LoadStatus): { text: string; spoken: string } | null {
  if (isRisk(before.zone) || !isRisk(after.zone) || after.ratio === null) return null;
  const ratio = formatRatio(after.ratio);
  const text =
    after.zone === 'alta'
      ? `Carga alta: ${ratio} sua média semanal. Pegue leve nos próximos dias.`
      : `Carga subindo: ${ratio} sua média semanal. Vá com calma.`;
  return { text: `⚠️ ${text}`, spoken: text.replace('×', ' vezes') };
}
