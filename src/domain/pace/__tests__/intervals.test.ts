import { describeSeries, lapStats, parseLapTime, splitTimes } from '../intervals';

describe('splitTimes', () => {
  it('tempo de cada distância para um pace', () => {
    expect(splitTimes(230)).toEqual([
      { distanceMeters: 200, seconds: 46 },
      { distanceMeters: 400, seconds: 92 },
      { distanceMeters: 800, seconds: 184 },
      { distanceMeters: 1000, seconds: 230 },
    ]);
  });

  it('aceita distâncias próprias', () => {
    expect(splitTimes(300, [150])).toEqual([{ distanceMeters: 150, seconds: 45 }]);
  });
});

describe('lapStats', () => {
  it('média, melhor, pior, variação, desvio e pace médio', () => {
    const stats = lapStats([92, 90, 94, 92], 400)!;
    expect(stats).toMatchObject({
      count: 4,
      totalSeconds: 368,
      average: 92,
      best: 90,
      worst: 94,
      bestIndex: 1,
      worstIndex: 2,
      spread: 4,
      secondsPerKm: 230,
    });
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(2), 9);
  });

  it('ignora voltas inválidas', () => {
    expect(lapStats([90, NaN, 0, -3, 92], 400)).toMatchObject({ count: 2, average: 91 });
  });

  it('null sem voltas válidas ou com distância inválida', () => {
    expect(lapStats([], 400)).toBeNull();
    expect(lapStats([NaN], 400)).toBeNull();
    expect(lapStats([90], 0)).toBeNull();
  });

  it('uma volta só não tem variação', () => {
    expect(lapStats([95], 400)).toMatchObject({ spread: 0, stdDev: 0 });
  });
});

describe('describeSeries', () => {
  it('resume a série para a nota do diário', () => {
    const stats = lapStats([92, 90, 94, 92, 91, 93, 92, 92], 400)!;
    expect(describeSeries(stats, 400, 'km')).toBe('8×400 m · média 1:32 (3:50/km) · variação 4 s');
  });

  it('usa a unidade preferida no pace', () => {
    const stats = lapStats([240, 240], 1000)!;
    expect(describeSeries(stats, 1000, 'mi')).toBe('2×1000 m · média 4:00 (6:26/mi) · variação 0 s');
  });
});

describe('parseLapTime', () => {
  it.each([
    ['92', 92],
    ['92,5', 92.5],
    ['1:32', 92],
    ['1:32.4', 92.4],
    [' 3:05 ', 185],
  ])('"%s" → %p s', (input, expected) => {
    expect(parseLapTime(input)).toBe(expected);
  });

  it.each(['', 'abc', '0', '1:75', '-5'])('rejeita "%s"', (input) => {
    expect(parseLapTime(input)).toBeNull();
  });
});
