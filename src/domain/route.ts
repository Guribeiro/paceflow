/**
 * Trajeto da corrida: segmentos de pares [lat, lon]. Fica só no aparelho
 * (MMKV e backup JSON), nunca no Supabase.
 */

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

/** Abaixo disso o desvio é ruído do GPS: o ponto sai mesmo sem limite. */
const MIN_TOLERANCE_METERS = 1;
const METERS_PER_DEGREE = (6_371_000 * Math.PI) / 180;

/**
 * Douglas–Peucker numa passada só: a importância de cada ponto é o desvio
 * (m) com que ele foi escolhido, limitado pelo do ponto que abriu o seu
 * trecho. Para qualquer tolerância, o resultado clássico são os pontos com
 * importância acima dela; as pontas valem Infinity. Desvios num plano local
 * em metros (a escala de uma corrida dispensa o haversine).
 */
function importance(segment: [number, number][]): number[] {
  const n = segment.length;
  const result = new Array<number>(n).fill(0);
  if (n === 0) return result;
  result[0] = result[n - 1] = Infinity;
  const kx = METERS_PER_DEGREE * Math.cos((segment[0][0] * Math.PI) / 180);
  const xs = segment.map(([, lon]) => lon * kx);
  const ys = segment.map(([lat]) => lat * METERS_PER_DEGREE);

  const stack: [number, number, number][] = [[0, n - 1, Infinity]];
  while (stack.length > 0) {
    const [first, last, cap] = stack.pop()!;
    if (last - first < 2) continue;
    const ax = xs[first];
    const ay = ys[first];
    const bx = xs[last] - ax;
    const by = ys[last] - ay;
    const len2 = bx * bx + by * by;
    let worst = -1;
    let worstOffset = -1;
    for (let i = first + 1; i < last; i++) {
      const px = xs[i] - ax;
      const py = ys[i] - ay;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
      const offset = Math.hypot(px - t * bx, py - t * by);
      if (offset > worstOffset) {
        worst = i;
        worstOffset = offset;
      }
    }
    const value = Math.min(worstOffset, cap);
    result[worst] = value;
    stack.push([first, worst, value], [worst, last, value]);
  }
  return result;
}

/**
 * Reduz o trajeto para guardar: tira os desvios de até 1 m e, se ainda
 * passar de `maxPoints`, fica com os pontos mais importantes (pontas
 * primeiro; com pontas demais, as do começo do trajeto). Coordenadas com 5
 * casas (~1 m).
 */
export function simplifyRoute(route: Route, maxPoints = 500): Route {
  const rounded: Route = route.map((segment) => segment.map(([lat, lon]) => [round5(lat), round5(lon)]));
  const candidates: { segment: number; index: number; weight: number }[] = [];
  rounded.forEach((segment, s) => {
    importance(segment).forEach((weight, index) => {
      if (weight > MIN_TOLERANCE_METERS) candidates.push({ segment: s, index, weight });
    });
  });
  // A ordem de candidates é a do trajeto; o sort é estável, então empates ficam com o começo.
  const kept =
    candidates.length > maxPoints
      ? [...candidates].sort((a, b) => b.weight - a.weight).slice(0, Math.max(0, maxPoints))
      : candidates;
  const keep = rounded.map((segment) => new Array<boolean>(segment.length).fill(false));
  for (const c of kept) keep[c.segment][c.index] = true;
  return rounded.map((segment, s) => segment.filter((_, i) => keep[s][i])).filter((segment) => segment.length > 0);
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
