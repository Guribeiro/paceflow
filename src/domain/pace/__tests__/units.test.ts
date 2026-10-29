import { KM_PER_MILE, distanceInUnit, formatDistance, toKilometers, toMiles } from '../units';

describe('units', () => {
  it('usa a constante exata da milha internacional', () => {
    expect(KM_PER_MILE).toBe(1.609344);
  });

  it('converte milhas para km', () => {
    expect(toKilometers(1, 'mi')).toBeCloseTo(1.609344, 9);
    expect(toKilometers(26.2, 'mi')).toBeCloseTo(42.1648, 4);
  });

  it('mantém km como km', () => {
    expect(toKilometers(10, 'km')).toBe(10);
  });

  it('converte km para milhas', () => {
    expect(toMiles(1.609344)).toBeCloseTo(1, 9);
    expect(toMiles(5)).toBeCloseTo(3.106856, 6);
  });
});

describe('formatDistance', () => {
  it.each([
    [5000, 'km', '5,00'],
    [21097.5, 'km', '21,10'],
    [400, 'km', '0,40'],
    [1609.344, 'mi', '1,00'],
    [5000, 'mi', '3,11'],
  ] as const)('%p m em %s → "%s"', (meters, unit, expected) => {
    expect(formatDistance(meters, unit)).toBe(expected);
  });
});

describe('distanceInUnit', () => {
  it('converte metros para a unidade escolhida', () => {
    expect(distanceInUnit(5000, 'km')).toBe(5);
    expect(distanceInUnit(1609.344, 'mi')).toBeCloseTo(1, 9);
  });
});
