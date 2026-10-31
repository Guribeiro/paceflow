/** Meta semanal que passou a valer na semana `week` (segunda, AAAA-MM-DD); null = sem meta. */
export interface GoalChange {
  week: string;
  meters: number | null;
}

/** Mudanças da meta, da mais antiga à mais recente (uma por semana). */
export type GoalHistory = readonly GoalChange[];

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

export function parseGoalHistory(value: unknown): GoalChange[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.every(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      typeof c.week === 'string' &&
      WEEK.test(c.week) &&
      (c.meters === null || (typeof c.meters === 'number' && Number.isFinite(c.meters) && c.meters > 0)),
  );
  if (!valid) return null;
  return [...(value as GoalChange[])].sort((a, b) => a.week.localeCompare(b.week));
}

/** Antes de qualquer semana: a meta que já valia quando o histórico começou. */
const SINCE_ALWAYS = '0000-01-01';

/**
 * Registra a meta da semana `week`, substituindo uma mudança anterior da
 * mesma semana. No primeiro registro, a meta anterior passa a valer para
 * todas as semanas passadas.
 */
export function recordGoal(
  history: GoalHistory,
  week: string,
  meters: number | null,
  previousGoal: number | null,
): GoalChange[] {
  const base = history.length > 0 ? history : [{ week: SINCE_ALWAYS, meters: previousGoal }];
  return [...base.filter((c) => c.week !== week), { week, meters }].sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Meta que valia na semana `week`: a última mudança até ela. Semanas
 * anteriores ao histórico usam a primeira meta registrada; sem histórico,
 * vale a meta atual.
 */
export function goalForWeek(history: GoalHistory, week: string, currentGoal: number | null): number | null {
  if (history.length === 0) return currentGoal;
  let goal = history[0].meters;
  for (const change of history) {
    if (change.week > week) break;
    goal = change.meters;
  }
  return goal;
}
