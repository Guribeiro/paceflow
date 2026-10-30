import { haversineMeters } from '../geo';
import { ROUTE_MAX_POINTS, type Route, parseRoute, routePointCount, routeToSvg, simplifyRoute } from '../route';

// Perto de São Paulo: graus por metro de latitude e de longitude.
const LAT0 = -23.5;
const LON0 = -46.6;
const M_LAT = 1 / 111_195;
const M_LON = 1 / (111_195 * Math.cos((LAT0 * Math.PI) / 180));

/** Ponto a `north` metros ao norte e `east` metros a leste da origem. */
const at = (north: number, east = 0): [number, number] => [LAT0 + north * M_LAT, LON0 + east * M_LON];

/** Linha reta para o norte, um ponto a cada `step` metros. */
const line = (count: number, step = 10) => Array.from({ length: count }, (_, i) => at(i * step));

/** Zigue-zague para o norte, alternando 20 m a leste e a oeste. */
const zigzag = (count: number) => Array.from({ length: count }, (_, i) => at(i * 10, i % 2 === 0 ? 20 : -20));

describe('haversineMeters (geo)', () => {
  it('mede as distâncias usadas nos testes do trajeto', () => {
    expect(haversineMeters({ latitude: LAT0, longitude: LON0 }, { latitude: at(100)[0], longitude: LON0 })).toBeCloseTo(100, 1);
    const [lat, lon] = at(0, 100);
    expect(haversineMeters({ latitude: LAT0, longitude: LON0 }, { latitude: lat, longitude: lon })).toBeCloseTo(100, 1);
  });
});

describe('parseRoute', () => {
  it('aceita segmentos de pares [lat, lon], inclusive nos limites', () => {
    const route: Route = [[at(0), at(10)], [[90, 180], [-90, -180]]];
    expect(parseRoute(route)).toEqual(route);
  });

  it('aceita até o limite de pontos somando todos os segmentos', () => {
    const half = Array.from({ length: ROUTE_MAX_POINTS / 2 }, () => at(0));
    expect(parseRoute([half, half])).not.toBeNull();
    expect(parseRoute([half, [...half, at(0)]])).toBeNull();
  });

  it.each([
    ['null', null],
    ['texto', 'rota'],
    ['objeto', { 0: [at(0)] }],
    ['segmento que não é lista', [at(0)[0]]],
    ['segmento vazio', [[at(0)], []]],
    ['ponto com três números', [[[LAT0, LON0, 5]]]],
    ['ponto com um número', [[[LAT0]]]],
    ['coordenada em texto', [[['-23.5', LON0]]]],
    ['latitude NaN', [[[Number.NaN, LON0]]]],
    ['longitude infinita', [[[LAT0, Number.POSITIVE_INFINITY]]]],
    ['latitude acima de 90', [[[90.0001, LON0]]]],
    ['latitude abaixo de -90', [[[-90.0001, LON0]]]],
    ['longitude acima de 180', [[[LAT0, 180.0001]]]],
    ['longitude abaixo de -180', [[[LAT0, -180.0001]]]],
  ])('rejeita %s', (_name, value) => {
    expect(parseRoute(value)).toBeNull();
  });
});

describe('routePointCount', () => {
  it('soma os pontos de todos os segmentos', () => {
    expect(routePointCount([])).toBe(0);
    expect(routePointCount([line(3), line(2)])).toBe(5);
  });
});

describe('simplifyRoute', () => {
  const round5 = ([lat, lon]: [number, number]): [number, number] => [
    Math.round(lat * 1e5) / 1e5,
    Math.round(lon * 1e5) / 1e5,
  ];

  it('uma linha reta vira só as duas pontas', () => {
    const points = line(200);
    expect(simplifyRoute([points])).toEqual([[round5(points[0]), round5(points[199])]]);
  });

  it('mantém as curvas que se afastam mais de 1 m da reta', () => {
    // 100 m para o norte e 100 m para leste: a esquina fica.
    const corner = [...line(11), ...Array.from({ length: 10 }, (_, i) => at(100, (i + 1) * 10))];
    expect(simplifyRoute([corner])).toEqual([[round5(at(0)), round5(at(100)), round5(at(100, 100))]]);
  });

  it('arredonda as coordenadas para 5 casas', () => {
    expect(simplifyRoute([[[-23.123456789, -46.987654321]]])).toEqual([[[-23.12346, -46.98765]]]);
  });

  it('respeita o limite de pontos, mantendo as pontas', () => {
    const points = zigzag(600);
    expect(routePointCount(simplifyRoute([points], 600))).toBe(600);

    const result = simplifyRoute([points], 50);
    expect(routePointCount(result)).toBeLessThanOrEqual(50);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual(round5(points[0]));
    expect(result[0].at(-1)).toEqual(round5(points[599]));
  });

  it('o limite padrão é 500 pontos', () => {
    expect(routePointCount(simplifyRoute([zigzag(600)]))).toBeLessThanOrEqual(500);
  });

  it('simplifica cada segmento separado, sem juntar os trechos', () => {
    const second = line(50).map(([lat, lon]) => [lat, lon + 1000 * M_LON] as [number, number]);
    expect(simplifyRoute([line(50), second])).toEqual([
      [round5(at(0)), round5(at(490))],
      [round5(second[0]), round5(second[49])],
    ]);
  });

  it('com pontas demais para o limite, fica o começo do trajeto', () => {
    const segments = Array.from({ length: 10 }, (_, i) => [at(0, i * 100), at(100, i * 100)]);
    expect(simplifyRoute(segments, 5)).toEqual([
      [round5(segments[0][0]), round5(segments[0][1])],
      [round5(segments[1][0]), round5(segments[1][1])],
      [round5(segments[2][0])],
    ]);
  });

  it('não altera o trajeto recebido', () => {
    const route = [zigzag(100)];
    const copy = JSON.parse(JSON.stringify(route));
    simplifyRoute(route, 10);
    expect(route).toEqual(copy);
  });
});

describe('simplifyRoute (Douglas–Peucker por importância)', () => {
  const round5 = ([lat, lon]: [number, number]): [number, number] => [
    Math.round(lat * 1e5) / 1e5,
    Math.round(lon * 1e5) / 1e5,
  ];
  const UNLIMITED = Number.MAX_SAFE_INTEGER;
  const METERS_PER_DEGREE = (6_371_000 * Math.PI) / 180;

  /** Douglas–Peucker recursivo clássico, no mesmo plano local em metros (x pela latitude do 1º ponto). */
  function referenceDP(segment: [number, number][], tolerance: number): [number, number][] {
    if (segment.length <= 2) return segment;
    const kx = METERS_PER_DEGREE * Math.cos((segment[0][0] * Math.PI) / 180);
    const xy = segment.map(([lat, lon]) => [lon * kx, lat * METERS_PER_DEGREE] as const);
    const keep = new Array<boolean>(segment.length).fill(false);
    keep[0] = keep[segment.length - 1] = true;
    const recurse = (first: number, last: number) => {
      if (last - first < 2) return;
      const [ax, ay] = xy[first];
      const bx = xy[last][0] - ax;
      const by = xy[last][1] - ay;
      const len2 = bx * bx + by * by;
      let worst = -1;
      let worstOffset = -1;
      for (let i = first + 1; i < last; i++) {
        const px = xy[i][0] - ax;
        const py = xy[i][1] - ay;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
        const offset = Math.hypot(px - t * bx, py - t * by);
        if (offset > worstOffset) {
          worst = i;
          worstOffset = offset;
        }
      }
      if (worstOffset > tolerance) {
        keep[worst] = true;
        recurse(first, worst);
        recurse(worst, last);
      }
    };
    recurse(0, segment.length - 1);
    return segment.filter((_, i) => keep[i]);
  }

  /** Gerador pseudoaleatório com seed fixa (mulberry32). */
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Trajeto de passos de ~10 m com curvas e ruído lateral de até `jitter` metros. */
  function randomRoute(seed: number, jitter: number, sizes: number[]): Route {
    const rnd = random(seed);
    let north = 0;
    let east = 0;
    let heading = rnd() * 2 * Math.PI;
    return sizes.map((size) =>
      Array.from({ length: size }, () => {
        if (rnd() < 0.1) heading += (rnd() - 0.5) * Math.PI;
        north += 10 * Math.cos(heading);
        east += 10 * Math.sin(heading);
        return at(north + (rnd() - 0.5) * 2 * jitter, east + (rnd() - 0.5) * 2 * jitter);
      }),
    );
  }

  const cases = [
    { seed: 1, jitter: 0.8, sizes: [300] },
    { seed: 2, jitter: 2, sizes: [250, 1, 2, 120] },
    { seed: 3, jitter: 5, sizes: [400] },
    { seed: 4, jitter: 1.5, sizes: [3, 180, 60] },
  ];

  it.each(cases)('sem limite, é o Douglas–Peucker clássico com tolerância de 1 m (seed $seed)', ({ seed, jitter, sizes }) => {
    const route = randomRoute(seed, jitter, sizes);
    const expected = route.map((segment) => referenceDP(segment.map(round5), 1));
    expect(simplifyRoute(route, UNLIMITED)).toEqual(expected);
  });

  it.each(cases)('com limite, fica com exatamente min(limite, candidatos) pontos, todos do resultado sem limite (seed $seed)', ({ seed, jitter, sizes }) => {
    const route = randomRoute(seed, jitter, sizes);
    const keys = (max: number) => new Set(simplifyRoute(route, max).flat().map((p) => JSON.stringify(p)));
    const full = keys(UNLIMITED);
    const candidates = routePointCount(simplifyRoute(route, UNLIMITED));
    for (const max of [1, 2, 5, 37, candidates - 1, candidates, candidates + 10]) {
      const result = simplifyRoute(route, max);
      expect(routePointCount(result)).toBe(Math.min(max, candidates));
      expect(result.every((segment) => segment.length > 0)).toBe(true);
    }
    // Um limite menor só tira pontos de um limite maior, e todos vêm do resultado sem limite.
    const small = keys(20);
    const large = keys(60);
    expect([...small].filter((k) => !large.has(k))).toEqual([]);
    expect([...large].filter((k) => !full.has(k))).toEqual([]);
  });

  it('com limite, prioriza o ponto de maior desvio', () => {
    // 100 m para o norte; o ponto dos 50 m sai 30 m para leste, os dos 20 e 80 m saem 3 m.
    const points = Array.from({ length: 11 }, (_, i) => at(i * 10, i === 5 ? 30 : i === 2 || i === 8 ? 3 : 0));
    expect(simplifyRoute([points], 3)).toEqual([[round5(points[0]), round5(points[5]), round5(points[10])]]);
  });

  it('a importância de um ponto é limitada pela do ponto que abriu o seu trecho', () => {
    // Segmento 1: o ponto dos 50 m sai só 2 m da reta, mas dentro do trecho dele o
    // ponto dos 90 m fica a ~40 m da corda; vale 2 m, não 40.
    const backtrack = [at(0), at(90), at(50, 2), at(100)];
    // Segmento 2: uma reta com um desvio de 10 m no meio.
    const bump = [at(0, 500), at(50, 510), at(100, 500)];
    expect(simplifyRoute([backtrack, bump], 5)).toEqual([
      [round5(backtrack[0]), round5(backtrack[3])],
      [round5(bump[0]), round5(bump[1]), round5(bump[2])],
    ]);
    // Sem limite, os dois pontos do segmento 1 ficam (os dois passam de 1 m).
    expect(routePointCount(simplifyRoute([backtrack, bump], UNLIMITED))).toBe(7);
  });

  it('em empate de importância, fica o ponto do começo do trajeto', () => {
    const peak = [at(0), at(50, 10), at(100)];
    expect(simplifyRoute([peak, peak], 5)).toEqual([
      [round5(peak[0]), round5(peak[1]), round5(peak[2])],
      [round5(peak[0]), round5(peak[2])],
    ]);
  });

  it.each([0, -1])('com limite %p devolve um trajeto vazio', (max) => {
    expect(simplifyRoute([zigzag(50), line(10)], max)).toEqual([]);
  });

  it('um segmento de um ponto só é mantido', () => {
    expect(simplifyRoute([[at(0)]], UNLIMITED)).toEqual([[round5(at(0))]]);
  });

  it('simplifica um zigue-zague de 2000 pontos em menos de 1 s', () => {
    const points = zigzag(2000);
    const started = performance.now();
    const result = simplifyRoute([points]);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
    expect(routePointCount(result)).toBe(500);
  });
});

describe('routeToSvg', () => {
  const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

  it('null sem pontos', () => {
    expect(routeToSvg([], 100)).toBeNull();
    expect(routeToSvg([[]], 100)).toBeNull();
  });

  it('um ponto só fica no centro', () => {
    expect(routeToSvg([[at(0)]], 100, 6)).toEqual({ paths: ['M50 50'], start: { x: 50, y: 50 }, end: { x: 50, y: 50 } });
  });

  it('mantém a proporção: 200 m para leste e 100 m para o norte ocupam a largura e metade da altura', () => {
    const svg = routeToSvg([[at(0), at(0, 200), at(100, 200)]], 100)!;
    expect(svg.paths).toHaveLength(1);
    const [x0, y0, x1, y1, x2, y2] = nums(svg.paths[0]);
    expect([x0, y0]).toEqual([0, 75]);
    expect([x1, y1]).toEqual([100, 75]);
    // O norte fica para cima.
    expect([x2, y2]).toEqual([100, 25]);
    expect(svg.start.x).toBeCloseTo(0, 2);
    expect(svg.start.y).toBeCloseTo(75, 2);
    expect(svg.end.x).toBeCloseTo(100, 2);
    expect(svg.end.y).toBeCloseTo(25, 2);
  });

  it('um trajeto alto fica centralizado na largura', () => {
    const svg = routeToSvg([[at(0), at(100, 50)]], 100)!;
    expect(svg.paths).toEqual(['M25 100 L75 0']);
  });

  it('respeita a margem', () => {
    const svg = routeToSvg([[at(0), at(100, 100)]], 100, 10)!;
    expect(svg.paths).toEqual(['M10 90 L90 10']);
  });

  it('desenha cada segmento como um caminho, com início e fim do trajeto todo', () => {
    const svg = routeToSvg([[at(0), at(100)], [at(100, 100), at(0, 100)]], 100)!;
    expect(svg.paths).toEqual(['M0 100 L0 0', 'M100 0 L100 100']);
    expect(svg.start.x).toBeCloseTo(0, 2);
    expect(svg.start.y).toBeCloseTo(100, 2);
    expect(svg.end.x).toBeCloseTo(100, 2);
    expect(svg.end.y).toBeCloseTo(100, 2);
  });
});
