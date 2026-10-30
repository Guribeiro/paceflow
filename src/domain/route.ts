/**
 * Trajeto da corrida: segmentos de pares [lat, lon]. Fica só no aparelho
 * (MMKV e backup JSON), nunca no Supabase.
 */

import { haversineMeters } from './geo';

export type Route = [number, number][][];

/** Distância mínima entre pontos guardados durante a corrida. */
export const ROUTE_STEP_METERS = 10;
/** Teto do trajeto (uns 100 km com um ponto a cada 10 m). */
export const ROUTE_MAX_POINTS = 10_000;

const isCoord = (v: unknown, limit: number) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit;

const isPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && isCoord(v[0], 90) && isCoord(v[1], 180);

/** Valida um trajeto salvo ou importado; null se não for um trajeto reconhecível. */
export function parseRoute(value: unknown): Route | null {
  if (!Array.isArray(value)) return null;
  let points = 0;
  for (const segment of value) {
    if (!Array.isArray(segment) || segment.length === 0 || !segment.every(isPair)) return null;
    points += segment.length;
    if (points > ROUTE_MAX_POINTS) return null;
  }
  return value as Route;
}

export const routePointCount = (route: Route) => route.reduce((n, segment) => n + segment.length, 0);

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Distância (m) do ponto p à reta a–b, num plano local em metros. */
function offsetMeters(p: [number, number], a: [number, number], b: [number, number]): number {
  const toMeters = (q: [number, number]) => {
    const north = haversineMeters({ latitude: a[0], longitude: a[1] }, { latitude: q[0], longitude: a[1] });
    const east = haversineMeters({ latitude: q[0], longitude: a[1] }, { latitude: q[0], longitude: q[1] });
    return [Math.sign(q[1] - a[1]) * east, Math.sign(q[0] - a[0]) * north] as const;
  };
  const [bx, by] = toMeters(b);
  const [px, py] = toMeters(p);
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Douglas–Peucker: mantém as pontas e os pontos que se afastam mais que `tolerance` metros. */
function simplifySegment(segment: [number, number][], tolerance: number): [number, number][] {
  if (segment.length <= 2) return segment;
  const keep = new Array<boolean>(segment.length).fill(false);
  keep[0] = keep[segment.length - 1] = true;
  const stack: [number, number][] = [[0, segment.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let worst = -1;
    let worstOffset = tolerance;
    for (let i = first + 1; i < last; i++) {
      const offset = offsetMeters(segment[i], segment[first], segment[last]);
      if (offset > worstOffset) {
        worst = i;
        worstOffset = offset;
      }
    }
    if (worst !== -1) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return segment.filter((_, i) => keep[i]);
}

/**
 * Reduz o trajeto para guardar: a tolerância (m) dobra até caber em `maxPoints`;
 * coordenadas com 5 casas (~1 m).
 */
export function simplifyRoute(route: Route, maxPoints = 500): Route {
  const rounded: Route = route.map((segment) => segment.map(([lat, lon]) => [round5(lat), round5(lon)]));
  let tolerance = 1;
  let result = rounded.map((segment) => simplifySegment(segment, tolerance));
  // Com 100 km de tolerância sobra só as pontas: o laço sempre termina.
  while (routePointCount(result) > maxPoints && tolerance < 100_000) {
    tolerance *= 2;
    result = rounded.map((segment) => simplifySegment(segment, tolerance));
  }
  // Pontas demais (muitas retomadas): fica o começo do trajeto.
  let left = maxPoints;
  return result.flatMap((segment) => {
    const part = segment.slice(0, Math.max(0, left));
    left -= part.length;
    return part.length > 0 ? [part] : [];
  });
}

export interface RouteSvg {
  /** Atributo `d` de cada segmento (um ponto só vira um traço de comprimento zero). */
  paths: string[];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const fmt = (v: number) => String(Math.round(v * 10) / 10);

/**
 * Desenho num quadrado `size`×`size`: projeção equiretangular (x = lon·cos(lat
 * médio), y = −lat), escala única que cabe e centralizada. null sem pontos.
 */
export function routeToSvg(route: Route, size: number, padding = 0): RouteSvg | null {
  const points = route.flat();
  if (points.length === 0) return null;
  const meanLat = points.reduce((sum, [lat]) => sum + lat, 0) / points.length;
  const cos = Math.cos((meanLat * Math.PI) / 180);
  const project = ([lat, lon]: [number, number]) => [lon * cos, -lat] as const;
  const projected = points.map(project);
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const inner = size - 2 * padding;
  const scale = Math.max(width, height) > 0 ? inner / Math.max(width, height) : 0;
  const offsetX = padding + (inner - width * scale) / 2;
  const offsetY = padding + (inner - height * scale) / 2;
  const toXY = (p: [number, number]) => {
    const [x, y] = project(p);
    return { x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale };
  };

  const paths = route
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment
        .map((p, i) => {
          const { x, y } = toXY(p);
          return `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`;
        })
        .join(' '),
    );
  return { paths, start: toXY(points[0]), end: toXY(points[points.length - 1]) };
}
