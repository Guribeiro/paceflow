/**
 * Gravação de corrida a partir de amostras de GPS: distância, tempo em
 * movimento, parciais e (se ligado) o trajeto.
 */

import { haversineMeters } from './geo';
import { ROUTE_MAX_POINTS, ROUTE_STEP_METERS, type Route, parseRoute, routePointCount } from './route';

export { haversineMeters };

export interface RunSample {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros; null quando o aparelho não informa. */
  accuracy: number | null;
  /** ms desde a época (Location.timestamp). */
  timestamp: number;
  /**
   * Velocidade medida pelo GPS (m/s, por Doppler); null/ausente quando o
   * aparelho não informa. Andando, a posição é suavizada e quase não sai do
   * lugar, mas a velocidade não: é ela que decide parado ou em movimento.
   */
  speed?: number | null;
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
  /**
   * Trajeto em segmentos [lat, lon]; cada retomada abre um segmento, para o
   * trecho em pausa não virar uma reta. null: guardar trajeto desligado no início.
   */
  route: Route | null;
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
/** Parado, o GPS mede 0,1–0,3 m/s; andando, 0,7 ou mais. */
export const MOVING_SPEED_MPS = 0.5;
/** Sem velocidade do GPS: raio de parada, maior que a tremida do GPS parado. */
export const STILL_RADIUS_METERS = 6;
/** Sem velocidade do GPS: distância do ponto onde parou para a pausa automática terminar. */
export const RESUME_METERS = 10;

/** Velocidade do GPS utilizável (o Android manda negativa ou ausente quando não sabe). */
const gpsSpeed = (sample: RunSample): number | null =>
  typeof sample.speed === 'number' && Number.isFinite(sample.speed) && sample.speed >= 0 ? sample.speed : null;

/** Acrescenta o ponto (num segmento novo, se pedido); fora do teto ou perto demais do último, nada muda. */
function addRoutePoint(route: Route | null, at: { latitude: number; longitude: number }, newSegment: boolean): Route | null {
  if (route === null || routePointCount(route) >= ROUTE_MAX_POINTS) return route;
  const point: [number, number] = [at.latitude, at.longitude];
  const last = route[route.length - 1];
  if (newSegment || last === undefined) return [...route, [point]];
  const [lat, lon] = last[last.length - 1];
  if (haversineMeters({ latitude: lat, longitude: lon }, at) < ROUTE_STEP_METERS) return route;
  return [...route.slice(0, -1), [...last, point]];
}

export function startRun(now: number, splitMeters = 1000, autoPause = false, keepRoute = false): RunState {
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
    route: keepRoute ? [] : null,
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
      const speed = gpsSpeed(sample);
      const away =
        speed !== null ? speed >= MOVING_SPEED_MPS : haversineMeters(next.lastPoint!, sample) >= RESUME_METERS;
      // Uma amostra em movimento sozinha pode ser erro do GPS: espera a seguinte confirmar.
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
        route: addRoutePoint(next.route, sample, true),
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
      next = { ...next, lastPoint: point, lastMoveAt: sample.timestamp, anchor, route: addRoutePoint(next.route, sample, true) };
      continue;
    }
    const lastPoint = next.lastPoint;
    const step = haversineMeters(lastPoint, point);
    const dt = movingMs - lastPoint.movingMs;
    // Passo somado à distância: tira a tremida (< 3 m) e os saltos impossíveis.
    const accepted = step >= MIN_STEP_METERS && dt > 0 && step / (dt / 1000) <= MAX_SPEED_MPS;

    const { anchor } = next;
    const speed = gpsSpeed(sample);
    const moving =
      speed !== null
        ? speed >= MOVING_SPEED_MPS
        : anchor === null || haversineMeters(anchor, sample) >= STILL_RADIUS_METERS;
    if (moving) {
      // A distância do novo centro já inclui o passo desta amostra: a pausa nunca tira chão corrido antes dele.
      const distanceMeters = next.distanceMeters + (accepted ? step : 0);
      next = { ...next, lastMoveAt: sample.timestamp, anchor: { latitude: sample.latitude, longitude: sample.longitude, distanceMeters } };
    } else {
      const pauseAt = stoppedAt(next, sample.timestamp);
      if (pauseAt !== null) {
        // Parado: o tempo congela no instante da pausa e a tremida somada desde a
        // última amostra em movimento sai da distância (se nenhuma parcial fechou nesse meio-tempo).
        // Sem centro (estado antigo), não há o que devolver.
        const restore = anchor?.distanceMeters ?? next.distanceMeters;
        const closedSince = next.splits.length > Math.floor(restore / next.splitMeters);
        next = {
          ...next,
          autoPaused: true,
          movingMs: next.movingMs + (pauseAt - resumedAt),
          resumedAt: null,
          distanceMeters: closedSince ? next.distanceMeters : restore,
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
      route: addRoutePoint(next.route, sample, false),
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
    (s.route === undefined || s.route === null || parseRoute(s.route) !== null) &&
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
    // Corridas de antes do trajeto: sem rota.
    route: run.route ?? null,
  };
}
