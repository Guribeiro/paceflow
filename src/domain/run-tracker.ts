/**
 * Gravação de corrida a partir de amostras de GPS: distância, tempo em
 * movimento e parciais. Só números: a rota não é guardada.
 */

export interface RunSample {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros; null quando o aparelho não informa. */
  accuracy: number | null;
  /** ms desde a época (Location.timestamp). */
  timestamp: number;
}

export type RunStatus = 'running' | 'paused' | 'finished';

export interface RunState {
  status: RunStatus;
  /** Início da corrida (ms), para a data do treino. */
  startedAt: number;
  /** Tamanho de cada parcial: 1000 m ou uma milha. */
  splitMeters: number;
  distanceMeters: number;
  /** Tempo em movimento acumulado até `resumedAt` (ou até pausar/finalizar). */
  movingMs: number;
  /** Início do trecho atual em andamento; null quando pausada ou finalizada. */
  resumedAt: number | null;
  /** Tempo em movimento (ms, acumulado) em que cada parcial fechou. */
  splits: number[];
  /** Última amostra aceita; null no início e depois de retomar. */
  lastPoint: { latitude: number; longitude: number; movingMs: number } | null;
  /** Pontos (tempo em movimento, distância) da janela do pace atual. */
  recent: { movingMs: number; distanceMeters: number }[];
}

/** Amostras menos precisas que isso são descartadas. */
export const MAX_ACCURACY_METERS = 25;
/** Mais rápido que isso (36 km/h) é salto do GPS, não corrida. */
export const MAX_SPEED_MPS = 10;
/** Deslocamentos menores ficam acumulando: evita somar a tremida do GPS parado. */
export const MIN_STEP_METERS = 3;
/** Janela do pace atual. */
export const PACE_WINDOW_MS = 30_000;

const EARTH_RADIUS_METERS = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em metros entre dois pontos (haversine). */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function startRun(now: number, splitMeters = 1000): RunState {
  return {
    status: 'running',
    startedAt: now,
    splitMeters,
    distanceMeters: 0,
    movingMs: 0,
    resumedAt: now,
    splits: [],
    lastPoint: null,
    recent: [{ movingMs: 0, distanceMeters: 0 }],
  };
}

/** Tempo em movimento até `now`; pausas não contam. */
export function elapsedMs(state: RunState, now: number): number {
  return state.resumedAt === null ? state.movingMs : state.movingMs + Math.max(0, now - state.resumedAt);
}

export function pauseRun(state: RunState, now: number): RunState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', movingMs: elapsedMs(state, now), resumedAt: null };
}

export function resumeRun(state: RunState, now: number): RunState {
  if (state.status !== 'paused') return state;
  // Sem último ponto: o trecho entre pausar e retomar (andando até o carro, por ex.) não conta.
  return { ...state, status: 'running', resumedAt: now, lastPoint: null, recent: [] };
}

export function finishRun(state: RunState, now: number): RunState {
  if (state.status === 'finished') return state;
  return { ...state, status: 'finished', movingMs: elapsedMs(state, now), resumedAt: null };
}

/** Aplica amostras em ordem; ignora as que chegam fora de uma corrida em andamento. */
export function applySamples(state: RunState, samples: readonly RunSample[]): RunState {
  if (state.status !== 'running' || state.resumedAt === null) return state;
  let next = state;

  for (const sample of [...samples].sort((a, b) => a.timestamp - b.timestamp)) {
    const resumedAt = next.resumedAt!;
    if (sample.timestamp < resumedAt) continue; // amostra antiga, de antes de retomar
    if (sample.accuracy !== null && sample.accuracy > MAX_ACCURACY_METERS) continue;
    const movingMs = next.movingMs + (sample.timestamp - resumedAt);
    const point = { latitude: sample.latitude, longitude: sample.longitude, movingMs };

    if (next.lastPoint === null) {
      next = { ...next, lastPoint: point };
      continue;
    }
    const step = haversineMeters(next.lastPoint, point);
    const dt = movingMs - next.lastPoint.movingMs;
    if (step < MIN_STEP_METERS) continue;
    if (dt <= 0 || step / (dt / 1000) > MAX_SPEED_MPS) continue;

    const before = next.distanceMeters;
    const after = before + step;
    const splits = [...next.splits];
    // Parciais fechadas neste passo, com o instante interpolado na reta entre as amostras.
    for (let mark = (splits.length + 1) * next.splitMeters; mark <= after; mark += next.splitMeters) {
      splits.push(next.lastPoint.movingMs + ((mark - before) / step) * dt);
    }
    const recent = [...next.recent, { movingMs, distanceMeters: after }];
    // Mantém um ponto antes da janela, para a janela ficar inteira.
    while (recent.length > 2 && recent[1].movingMs <= movingMs - PACE_WINDOW_MS) recent.shift();

    next = { ...next, distanceMeters: after, splits, lastPoint: point, recent };
  }
  return next;
}

/** Pace atual (s/km) nos últimos ~30 s; null sem deslocamento suficiente. */
export function currentPace(state: RunState): number | null {
  if (state.status !== 'running' || state.recent.length < 2) return null;
  const first = state.recent[0];
  const last = state.recent[state.recent.length - 1];
  const meters = last.distanceMeters - first.distanceMeters;
  if (meters < 20) return null;
  return (last.movingMs - first.movingMs) / 1000 / (meters / 1000);
}

/** Duração de cada parcial fechada, em segundos. */
export function splitDurations(state: RunState): number[] {
  return state.splits.map((ms, i) => (ms - (i === 0 ? 0 : state.splits[i - 1])) / 1000);
}

/** Valida o estado salvo (MMKV); null se não for uma corrida reconhecível. */
export function parseRunState(value: unknown): RunState | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const ok =
    (s.status === 'running' || s.status === 'paused' || s.status === 'finished') &&
    num(s.startedAt) &&
    num(s.splitMeters) &&
    (s.splitMeters as number) > 0 &&
    num(s.distanceMeters) &&
    num(s.movingMs) &&
    (s.resumedAt === null || num(s.resumedAt)) &&
    Array.isArray(s.splits) &&
    s.splits.every(num) &&
    (s.lastPoint === null || typeof s.lastPoint === 'object') &&
    Array.isArray(s.recent);
  return ok ? (s as unknown as RunState) : null;
}
