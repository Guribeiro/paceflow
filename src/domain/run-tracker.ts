/**
 * Gravação de corrida a partir de amostras de GPS: distância, tempo em
 * movimento, parciais e (se ligado) o trajeto.
 */

import { haversineMeters } from './geo';
import { type IntervalPlan, type Phase, type PhaseKind, expandPhases, parseIntervalPlan } from './interval-plan';
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

/** Ponto da corrida em tempo em movimento e distância acumulada. */
export interface RunMark {
  movingMs: number;
  distanceMeters: number;
}

/** Fase concluída do intervalado. */
export interface PhaseResult {
  kind: PhaseKind;
  rep?: number;
  ms: number;
  meters: number;
  /** Encerrada pelo botão "Pular fase": não entra na média dos tiros. */
  skipped: boolean;
}

/** Andamento do treino intervalado guiado. */
export interface IntervalProgress {
  plan: IntervalPlan;
  /** Fase atual em expandPhases(plan); igual ao total quando o plano acabou. */
  index: number;
  phaseStart: RunMark;
  /** Última amostra aplicada: a voz calcula o que falta a partir dela. */
  at: RunMark;
  results: PhaseResult[];
  /** O pace da metade do tiro atual já foi medido. */
  paceChecked: boolean;
  /** Pace (s/km) do tiro atual até a metade; null antes de medir. */
  midPace: number | null;
}

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
  /** Treino intervalado guiado; null na corrida livre. */
  intervals: IntervalProgress | null;
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

export function startRun(
  now: number,
  splitMeters = 1000,
  autoPause = false,
  keepRoute = false,
  plan: IntervalPlan | null = null,
): RunState {
  const start = { movingMs: 0, distanceMeters: 0 };
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
    // Parar na recuperação é esperado: a pausa automática congelaria o tempo da fase.
    autoPause: plan ? false : autoPause,
    autoPaused: false,
    lastMoveAt: now,
    anchor: null,
    resumePending: false,
    route: keepRoute ? [] : null,
    intervals: plan
      ? { plan, index: 0, phaseStart: start, at: start, results: [], paceChecked: false, midPace: null }
      : null,
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
    const before = next.lastPoint ? { movingMs: next.lastPoint.movingMs, distanceMeters: next.distanceMeters } : null;
    next = applySample(next, sample);
    if (next.intervals) next = advanceIntervals(next, before, sample.timestamp);
  }
  return next;
}

/** Uma amostra: distância, parciais, pausa automática e trajeto. */
function applySample(state: RunState, sample: RunSample): RunState {
  let next = state;
  if (sample.accuracy !== null && sample.accuracy > MAX_ACCURACY_METERS) return next;

  if (next.autoPaused) {
    const speed = gpsSpeed(sample);
    const away =
      speed !== null ? speed >= MOVING_SPEED_MPS : haversineMeters(next.lastPoint!, sample) >= RESUME_METERS;
    // Uma amostra em movimento sozinha pode ser erro do GPS: espera a seguinte confirmar.
    if (!away || !next.resumePending) {
      if (next.resumePending !== away) next = { ...next, resumePending: away };
      return next;
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
    return next;
  }

  const resumedAt = next.resumedAt!;
  if (sample.timestamp < resumedAt) return next; // amostra antiga, de antes de retomar
  const movingMs = next.movingMs + (sample.timestamp - resumedAt);
  const point = { latitude: sample.latitude, longitude: sample.longitude, movingMs };

  if (next.lastPoint === null) {
    // O primeiro ponto (ou o primeiro depois de retomar): a parada conta a partir dele.
    const anchor = { latitude: sample.latitude, longitude: sample.longitude, distanceMeters: next.distanceMeters };
    next = { ...next, lastPoint: point, lastMoveAt: sample.timestamp, anchor, route: addRoutePoint(next.route, sample, true) };
    return next;
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
      return next;
    }
  }
  if (!accepted) return next;

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
  return next;
}

/** Distância mínima do tiro para o pace da metade ser confiável. */
const MIN_PACE_METERS = 50;

/** Fase atual; null quando o plano acabou. */
export function currentPhase(progress: IntervalProgress): Phase | null {
  return expandPhases(progress.plan)[progress.index] ?? null;
}

const lerp = (from: number, to: number, fraction: number) => from + (to - from) * fraction;

/**
 * Fecha as fases cumpridas entre a amostra anterior (`before`) e a atual. Por
 * distância, o fim é interpolado no tempo; por tempo, na distância. Uma amostra
 * pode fechar várias fases (o GPS voltou depois de um túnel).
 */
function advanceIntervals(state: RunState, before: RunMark | null, timestamp: number): RunState {
  const progress = state.intervals;
  if (!progress || state.resumedAt === null || timestamp < state.resumedAt) return state;
  const at = { movingMs: state.movingMs + (timestamp - state.resumedAt), distanceMeters: state.distanceMeters };
  const from = before ?? at;
  const phases = expandPhases(progress.plan);
  let { index, phaseStart, results, paceChecked, midPace } = progress;

  for (let phase = phases[index]; phase !== undefined; phase = phases[index]) {
    let end: RunMark;
    if (phase.measure.kind === 'distance') {
      const target = phaseStart.distanceMeters + phase.measure.meters;
      if (at.distanceMeters < target) break;
      const span = at.distanceMeters - from.distanceMeters;
      const fraction = span > 0 ? (target - from.distanceMeters) / span : 1;
      end = { movingMs: Math.max(phaseStart.movingMs, lerp(from.movingMs, at.movingMs, fraction)), distanceMeters: target };
    } else {
      const target = phaseStart.movingMs + phase.measure.seconds * 1000;
      if (at.movingMs < target) break;
      const span = at.movingMs - from.movingMs;
      const fraction = span > 0 ? (target - from.movingMs) / span : 1;
      end = {
        movingMs: target,
        distanceMeters: Math.max(phaseStart.distanceMeters, lerp(from.distanceMeters, at.distanceMeters, fraction)),
      };
    }
    results = [...results, phaseResult(phase, phaseStart, end, false)];
    phaseStart = end;
    index += 1;
    paceChecked = false;
    midPace = null;
  }

  // Pace na metade do tiro, uma vez por tiro e só com pace-alvo.
  const phase = phases[index];
  if (phase?.kind === 'work' && progress.plan.targetSecondsPerKm !== null && !paceChecked) {
    const meters = at.distanceMeters - phaseStart.distanceMeters;
    const ms = at.movingMs - phaseStart.movingMs;
    const half =
      phase.measure.kind === 'distance' ? meters >= phase.measure.meters / 2 : ms >= (phase.measure.seconds * 1000) / 2;
    if (half && meters >= MIN_PACE_METERS) {
      paceChecked = true;
      midPace = ms / 1000 / (meters / 1000);
    }
  }

  return { ...state, intervals: { ...progress, index, phaseStart, at, results, paceChecked, midPace } };
}

function phaseResult(phase: Phase, start: RunMark, end: RunMark, skipped: boolean): PhaseResult {
  return {
    kind: phase.kind,
    ...(phase.rep !== undefined ? { rep: phase.rep } : {}),
    ms: end.movingMs - start.movingMs,
    meters: end.distanceMeters - start.distanceMeters,
    skipped,
  };
}

/** Encerra a fase atual agora ("Pular fase"); o tiro pulado não entra na média. */
export function skipPhase(state: RunState, now: number): RunState {
  const progress = state.intervals;
  if (!progress || state.status === 'finished') return state;
  const phase = currentPhase(progress);
  if (!phase) return state;
  const end = { movingMs: elapsedMs(state, now), distanceMeters: state.distanceMeters };
  return {
    ...state,
    intervals: {
      ...progress,
      index: progress.index + 1,
      phaseStart: end,
      at: end,
      results: [...progress.results, phaseResult(phase, progress.phaseStart, end, true)],
      paceChecked: false,
      midPace: null,
    },
  };
}

export interface PhaseProgress {
  phase: Phase;
  /** Fase atual, a partir de 1, e o total. */
  number: number;
  total: number;
  /** Metros ou segundos que faltam, conforme a fase. */
  remaining: number;
  /** 0–1 */
  fraction: number;
}

/** Fase atual e quanto falta até `now`; null sem plano ou com ele concluído. */
export function phaseProgress(state: RunState, now: number): PhaseProgress | null {
  const progress = state.intervals;
  if (!progress) return null;
  const phases = expandPhases(progress.plan);
  const phase = phases[progress.index];
  if (!phase) return null;
  const size = phase.measure.kind === 'distance' ? phase.measure.meters : phase.measure.seconds;
  const done =
    phase.measure.kind === 'distance'
      ? state.distanceMeters - progress.phaseStart.distanceMeters
      : (elapsedMs(state, now) - progress.phaseStart.movingMs) / 1000;
  const clamped = Math.min(size, Math.max(0, done));
  return { phase, number: progress.index + 1, total: phases.length, remaining: size - clamped, fraction: clamped / size };
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

const isMark = (value: unknown): value is RunMark => {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return [m.movingMs, m.distanceMeters].every((v) => typeof v === 'number' && Number.isFinite(v));
};

const PHASE_KINDS: readonly unknown[] = ['warmup', 'work', 'recovery', 'cooldown'];

/** Andamento do intervalado salvo; undefined se inválido. */
function parseIntervals(value: unknown): IntervalProgress | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') return undefined;
  const p = value as Record<string, unknown>;
  const plan = parseIntervalPlan(p.plan);
  if (!plan) return undefined;
  const results = Array.isArray(p.results) ? p.results : null;
  const ok =
    Number.isInteger(p.index) &&
    (p.index as number) >= 0 &&
    (p.index as number) <= expandPhases(plan).length &&
    isMark(p.phaseStart) &&
    isMark(p.at) &&
    results !== null &&
    results.every((r) => {
      if (typeof r !== 'object' || r === null) return false;
      const x = r as Record<string, unknown>;
      return (
        PHASE_KINDS.includes(x.kind) &&
        typeof x.ms === 'number' &&
        typeof x.meters === 'number' &&
        typeof x.skipped === 'boolean' &&
        (x.rep === undefined || Number.isInteger(x.rep))
      );
    }) &&
    typeof p.paceChecked === 'boolean' &&
    (p.midPace === null || (typeof p.midPace === 'number' && Number.isFinite(p.midPace)));
  return ok ? ({ ...(p as unknown as IntervalProgress), plan } as IntervalProgress) : undefined;
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
  const intervals = parseIntervals(s.intervals);
  if (!ok || intervals === undefined) return null;
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
    // Corridas livres e de antes do intervalado.
    intervals,
  };
}
