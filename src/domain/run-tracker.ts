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
  /** Pausa automática ligada nesta corrida (a preferência no início dela). */
  autoPause: boolean;
  /**
   * Parado: o tempo não corre (resumedAt null) e lastPoint é o ponto onde
   * parou. A corrida segue "running"; só a pausa manual muda o status.
   */
  autoPaused: boolean;
  /** Instante (ms) em que saiu do raio de parada pela última vez; a pausa automática conta a partir dele. */
  lastMoveAt: number;
  /**
   * Centro do raio de parada (a tremida do GPS parado fica dentro dele) e a
   * distância quando entrou nele: a pausa devolve a distância a esse valor.
   */
  anchor: { latitude: number; longitude: number; distanceMeters: number } | null;
  /** Pausada, a última amostra já estava fora do raio de retomada: a próxima também precisa estar. */
  resumePending: boolean;
}

/** Amostras menos precisas que isso são descartadas. */
export const MAX_ACCURACY_METERS = 25;
/** Mais rápido que isso (36 km/h) é salto do GPS, não corrida. */
export const MAX_SPEED_MPS = 10;
/** Deslocamentos menores ficam acumulando: evita somar a tremida do GPS parado. */
export const MIN_STEP_METERS = 3;
/** Janela do pace atual. */
export const PACE_WINDOW_MS = 30_000;
/** Sem sair do raio de parada por mais que isso, a pausa automática congela o tempo (esses segundos contam). */
export const AUTO_PAUSE_MS = 8_000;
/** Raio de parada: maior que a tremida do GPS parado; correndo, sai dele em ~3 s. */
export const STILL_RADIUS_METERS = 6;
/** Distância do ponto onde parou para a pausa automática terminar (em duas amostras seguidas, contra saltos do GPS). */
export const RESUME_METERS = 10;

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

export function startRun(now: number, splitMeters = 1000, autoPause = false): RunState {
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
    autoPause,
    autoPaused: false,
    lastMoveAt: now,
    anchor: null,
    resumePending: false,
  };
}

/**
 * Instante em que o tempo para: parado há mais de AUTO_PAUSE_MS desde a última
 * amostra em movimento. Vale entre as amostras (com o GPS calado, o relógio da
 * tela congela já); a amostra seguinte grava a pausa no estado.
 */
function stoppedAt(state: RunState, now: number): number | null {
  if (!state.autoPause || state.status !== 'running' || state.autoPaused || state.lastPoint === null) return null;
  const at = state.lastMoveAt + AUTO_PAUSE_MS;
  return now > at ? at : null;
}

/** Em pausa automática (gravada ou já valendo pelo relógio)? */
export function isAutoPaused(state: RunState, now: number): boolean {
  return state.autoPaused || stoppedAt(state, now) !== null;
}

/** Tempo em movimento até `now`; pausas não contam. */
export function elapsedMs(state: RunState, now: number): number {
  if (state.resumedAt === null) return state.movingMs;
  return state.movingMs + Math.max(0, (stoppedAt(state, now) ?? now) - state.resumedAt);
}

export function pauseRun(state: RunState, now: number): RunState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', movingMs: elapsedMs(state, now), resumedAt: null, autoPaused: false, resumePending: false };
}

export function resumeRun(state: RunState, now: number): RunState {
  if (state.status !== 'paused') return state;
  // Sem último ponto: o trecho entre pausar e retomar (andando até o carro, por ex.) não conta.
  return { ...state, status: 'running', resumedAt: now, lastPoint: null, recent: [], lastMoveAt: now, anchor: null };
}

export function finishRun(state: RunState, now: number): RunState {
  if (state.status === 'finished') return state;
  return { ...state, status: 'finished', movingMs: elapsedMs(state, now), resumedAt: null, autoPaused: false, resumePending: false };
}

/** Aplica amostras em ordem; ignora as que chegam fora de uma corrida em andamento. */
export function applySamples(state: RunState, samples: readonly RunSample[]): RunState {
  if (state.status !== 'running' || (state.resumedAt === null && !state.autoPaused)) return state;
  let next = state;

  for (const sample of [...samples].sort((a, b) => a.timestamp - b.timestamp)) {
    if (sample.accuracy !== null && sample.accuracy > MAX_ACCURACY_METERS) continue;

    if (next.autoPaused) {
      const away = haversineMeters(next.lastPoint!, sample) >= RESUME_METERS;
      // Uma amostra longe sozinha pode ser salto do GPS: espera a seguinte confirmar.
      if (!away || !next.resumePending) {
        if (next.resumePending !== away) next = { ...next, resumePending: away };
        continue;
      }
      // Voltou a andar: retoma daqui, sem o trecho de saída (como na pausa manual).
      next = {
        ...next,
        autoPaused: false,
        resumePending: false,
        resumedAt: sample.timestamp,
        lastMoveAt: sample.timestamp,
        anchor: { latitude: sample.latitude, longitude: sample.longitude, distanceMeters: next.distanceMeters },
        lastPoint: { latitude: sample.latitude, longitude: sample.longitude, movingMs: next.movingMs },
        recent: [{ movingMs: next.movingMs, distanceMeters: next.distanceMeters }],
      };
      continue;
    }

    const resumedAt = next.resumedAt!;
    if (sample.timestamp < resumedAt) continue; // amostra antiga, de antes de retomar
    const movingMs = next.movingMs + (sample.timestamp - resumedAt);
    const point = { latitude: sample.latitude, longitude: sample.longitude, movingMs };

    if (next.lastPoint === null) {
      // O primeiro ponto (ou o primeiro depois de retomar): a parada conta a partir dele.
      const anchor = { latitude: sample.latitude, longitude: sample.longitude, distanceMeters: next.distanceMeters };
      next = { ...next, lastPoint: point, lastMoveAt: sample.timestamp, anchor };
      continue;
    }
    const lastPoint = next.lastPoint;
    const step = haversineMeters(lastPoint, point);
    const dt = movingMs - lastPoint.movingMs;
    // Passo somado à distância: tira a tremida (< 3 m) e os saltos impossíveis.
    const accepted = step >= MIN_STEP_METERS && dt > 0 && step / (dt / 1000) <= MAX_SPEED_MPS;

    const { anchor } = next;
    if (anchor === null || haversineMeters(anchor, sample) >= STILL_RADIUS_METERS) {
      // A distância do novo centro já inclui o passo desta amostra: a pausa nunca tira chão corrido antes dele.
      const distanceMeters = next.distanceMeters + (accepted ? step : 0);
      next = { ...next, lastMoveAt: sample.timestamp, anchor: { latitude: sample.latitude, longitude: sample.longitude, distanceMeters } };
    } else {
      const pauseAt = stoppedAt(next, sample.timestamp);
      if (pauseAt !== null) {
        // Parado: o tempo congela no instante da pausa e a tremida somada dentro do
        // raio sai da distância (se nenhuma parcial fechou nesse meio-tempo).
        const closedSince = next.splits.length > Math.floor(anchor.distanceMeters / next.splitMeters);
        next = {
          ...next,
          autoPaused: true,
          movingMs: next.movingMs + (pauseAt - resumedAt),
          resumedAt: null,
          distanceMeters: closedSince ? next.distanceMeters : anchor.distanceMeters,
        };
        continue;
      }
    }
    if (!accepted) continue;

    const before = next.distanceMeters;
    const after = before + step;
    const splits = [...next.splits];
    // Parciais fechadas neste passo, com o instante interpolado na reta entre as amostras.
    for (let mark = (splits.length + 1) * next.splitMeters; mark <= after; mark += next.splitMeters) {
      splits.push(lastPoint.movingMs + ((mark - before) / step) * dt);
    }
    const recent = [...next.recent, { movingMs, distanceMeters: after }];
    // Mantém um ponto antes da janela, para a janela ficar inteira.
    while (recent.length > 2 && recent[1].movingMs <= movingMs - PACE_WINDOW_MS) recent.shift();

    next = {
      ...next,
      distanceMeters: after,
      splits,
      lastPoint: point,
      recent,
    };
  }
  return next;
}

/** Pace atual (s/km) nos últimos ~30 s; null sem deslocamento suficiente. */
export function currentPace(state: RunState): number | null {
  if (state.status !== 'running' || state.autoPaused || state.recent.length < 2) return null;
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

/** Ponto salvo com latitude, longitude e o número extra (`movingMs` ou `distanceMeters`) finitos. */
function isPoint(value: unknown, extra: string): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return [p.latitude, p.longitude, p[extra]].every((v) => typeof v === 'number' && Number.isFinite(v));
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
    Array.isArray(s.recent) &&
    (s.autoPause === undefined || typeof s.autoPause === 'boolean') &&
    (s.autoPaused === undefined || typeof s.autoPaused === 'boolean') &&
    (s.lastMoveAt === undefined || num(s.lastMoveAt)) &&
    (s.anchor === undefined || s.anchor === null || isPoint(s.anchor, 'distanceMeters')) &&
    (s.lastPoint === null || isPoint(s.lastPoint, 'movingMs')) &&
    (s.resumePending === undefined || typeof s.resumePending === 'boolean') &&
    // Pausada automaticamente precisa do ponto onde parou.
    (s.autoPaused !== true || (s.status === 'running' && s.lastPoint !== null));
  if (!ok) return null;
  const run = s as unknown as RunState;
  // Corridas gravadas antes da pausa automática não têm os campos novos.
  return {
    ...run,
    autoPause: run.autoPause ?? false,
    autoPaused: run.autoPaused ?? false,
    lastMoveAt: run.lastMoveAt ?? run.resumedAt ?? run.startedAt,
    anchor: run.anchor ?? null,
    resumePending: run.resumePending ?? false,
  };
}
