import { RPE_MAX, RPE_MIN, TERRAINS, TERRAIN_LABELS } from '../domain/workout';

export const TERRAIN_OPTIONS = TERRAINS.map((t) => ({ value: t, label: TERRAIN_LABELS[t] }));

export const RPE_OPTIONS = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => ({
  value: RPE_MIN + i,
  label: String(RPE_MIN + i),
  spoken: `esforço ${RPE_MIN + i}`,
}));
