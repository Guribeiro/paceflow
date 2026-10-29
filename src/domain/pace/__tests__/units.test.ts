import { KM_PER_MILE, toKilometers, toMiles } from '../units';

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
