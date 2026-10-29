import { fitnessIndex, trainingPaces } from '../training-paces';

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`esperava ok, recebeu ${result.error}`);
  return result.value;
}

const mmss = (min: number, sec: number) => min * 60 + sec;

describe('fitnessIndex', () => {
  // Pontos de referência das tabelas de Daniels: 5 km em 19:57 ≈ 50, 10 km em 50:00 ≈ 40.
  it.each([
    [5, mmss(19, 57), 50],
    [10, mmss(50, 0), 40],
  ])('%p km em %p s ≈ %p', (km, seconds, expected) => {
    expect(fitnessIndex(km, seconds)).toBeCloseTo(expected, 0);
  });
});

describe('trainingPaces', () => {
  // Paces de referência para o índice 50 (5 km em 19:57), com tolerância de ±5 s/km.
  const paces = expectOk(trainingPaces(5, mmss(19, 57)));

  it.each([
    ['threshold', mmss(4, 15)],
    ['interval', mmss(3, 55)],
    ['repetition', mmss(3, 40)],
    ['marathon', mmss(4, 31)],
  ] as const)('%s ≈ referência', (zone, expected) => {
    expect(Math.abs(paces[zone].fastest - expected)).toBeLessThanOrEqual(5);
  });

  it('leve é uma faixa entre ~5:08 e ~5:38', () => {
    expect(Math.abs(paces.easy.fastest - mmss(5, 8))).toBeLessThanOrEqual(5);
    expect(Math.abs(paces.easy.slowest - mmss(5, 38))).toBeLessThanOrEqual(5);
  });

  it('as zonas ficam em ordem do mais lento ao mais rápido', () => {
    const order = [paces.easy.fastest, paces.marathon.fastest, paces.threshold.fastest, paces.interval.fastest, paces.repetition.fastest];
    expect([...order].sort((a, b) => b - a)).toEqual(order);
  });

  it('um corredor mais lento recebe paces mais lentos', () => {
    const slower = expectOk(trainingPaces(10, mmss(50, 0)));
    expect(slower.threshold.fastest).toBeGreaterThan(paces.threshold.fastest);
  });

  it.each([
    [1, mmss(4, 0), 'DISTANCE_OUT_OF_RANGE'],
    [50, mmss(240, 0), 'DISTANCE_OUT_OF_RANGE'],
    [5, mmss(2, 30), 'DURATION_OUT_OF_RANGE'],
    [42.195, mmss(400, 0), 'DURATION_OUT_OF_RANGE'],
    [NaN, 1200, 'DISTANCE_OUT_OF_RANGE'],
  ])('%p km em %p s → %s', (km, seconds, error) => {
    expect(trainingPaces(km, seconds)).toEqual({ ok: false, error });
  });
});
