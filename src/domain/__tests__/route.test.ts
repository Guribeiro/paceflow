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
