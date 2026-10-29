export interface GoalProgress {
  /** 0–1, para barras (limitado em 1). */
  ratio: number;
  /** Percentual real, arredondado (pode passar de 100). */
  percent: number;
  remainingMeters: number;
  reached: boolean;
}

export function goalProgress(distanceMeters: number, goalMeters: number): GoalProgress {
  const raw = goalMeters > 0 ? distanceMeters / goalMeters : 0;
  return {
    ratio: Math.min(1, raw),
    percent: Math.round(raw * 100),
    remainingMeters: Math.max(0, goalMeters - distanceMeters),
    reached: distanceMeters >= goalMeters,
  };
}
