import { calculatePace } from '../pace';

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`esperava ok, recebeu ${result.error}`);
  return result.value;
}

describe('calculatePace', () => {
  it('5 km em 25:00 → 5:00/km e 12 km/h', () => {
    const r = expectOk(calculatePace({ distance: 5, unit: 'km', durationSeconds: 1500 }));
    expect(r.secondsPerKm).toBeCloseTo(300, 9);
    expect(r.kmh).toBeCloseTo(12, 9);
  });

  it('10 km em 50:00 → 5:00/km', () => {
    const r = expectOk(calculatePace({ distance: 10, unit: 'km', durationSeconds: 3000 }));
    expect(r.secondsPerKm).toBeCloseTo(300, 9);
  });

  it('1 mi em 8:00 → ~4:58/km e 7,5 mph', () => {
    const r = expectOk(calculatePace({ distance: 1, unit: 'mi', durationSeconds: 480 }));
    expect(r.secondsPerMile).toBeCloseTo(480, 9);
    expect(r.secondsPerKm).toBeCloseTo(298.258, 3);
    expect(r.mph).toBeCloseTo(7.5, 9);
    expect(r.kmh).toBeCloseTo(12.07008, 5);
  });

  it('mantém precisão em tiros curtos de pista (400 m em 90 s)', () => {
    const r = expectOk(calculatePace({ distance: 0.4, unit: 'km', durationSeconds: 90 }));
    expect(r.secondsPerKm).toBeCloseTo(225, 9);
    expect(r.kmh).toBeCloseTo(16, 9);
  });

  it('expõe a distância normalizada em km', () => {
    const r = expectOk(calculatePace({ distance: 1, unit: 'mi', durationSeconds: 480 }));
    expect(r.distanceKm).toBeCloseTo(1.609344, 9);
  });

  it.each([0, -1, NaN, Infinity])('rejeita distância %p', (distance) => {
    expect(calculatePace({ distance, unit: 'km', durationSeconds: 1500 })).toEqual({
      ok: false,
      error: 'INVALID_DISTANCE',
    });
  });

  it.each([0, -1, NaN, Infinity])('rejeita duração %p', (durationSeconds) => {
    expect(calculatePace({ distance: 5, unit: 'km', durationSeconds })).toEqual({
      ok: false,
      error: 'INVALID_DURATION',
    });
  });
});
