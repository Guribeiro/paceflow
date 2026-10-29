import { RACE_DISTANCES, predictRaceTimes } from '../predictor';

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`esperava ok, recebeu ${result.error}`);
  return result.value;
}

describe('RACE_DISTANCES', () => {
  it('usa as distâncias oficiais', () => {
    expect(RACE_DISTANCES.map((r) => r.distanceKm)).toEqual([5, 10, 21.0975, 42.195]);
  });
});

describe('predictRaceTimes', () => {
  it('Riegel (padrão): 5 km em 25:00 → 10 km em ~52:07', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }));
    const tenK = races.find((r) => r.id === '10k')!;
    // 1500 × 2^1.06
    expect(tenK.durationSeconds).toBeCloseTo(3127.4, 1);
  });

  it('Riegel: a distância de referência projeta o próprio tempo', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }));
    expect(races.find((r) => r.id === '5k')!.durationSeconds).toBeCloseTo(1500, 9);
  });

  it('Riegel: 10 km em 50:00 → maratona em ~3:50:01', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 10, durationSeconds: 3000 }));
    const marathon = races.find((r) => r.id === 'marathon')!;
    expect(marathon.durationSeconds).toBeCloseTo(3000 * Math.pow(4.2195, 1.06), 6);
    expect(marathon.durationSeconds).toBeCloseTo(13800.6, 1);
  });

  it('aceita expoente customizado', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }, { exponent: 1.08 }));
    expect(races.find((r) => r.id === '10k')!.durationSeconds).toBeCloseTo(1500 * Math.pow(2, 1.08), 6);
  });

  it('linear: mantém o mesmo pace em todas as distâncias', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }, { method: 'linear' }));
    expect(races.map((r) => r.durationSeconds)).toEqual([
      expect.closeTo(1500, 9),
      expect.closeTo(3000, 9),
      expect.closeTo(6329.25, 9),
      expect.closeTo(12658.5, 9),
    ]);
    races.forEach((r) => expect(r.secondsPerKm).toBeCloseTo(300, 9));
  });

  it('inclui o pace projetado em cada prova', () => {
    const races = expectOk(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }));
    races.forEach((r) => expect(r.secondsPerKm).toBeCloseTo(r.durationSeconds / r.distanceKm, 9));
  });

  it.each([0, -1, NaN])('rejeita distância %p', (distanceKm) => {
    expect(predictRaceTimes({ distanceKm, durationSeconds: 1500 })).toEqual({
      ok: false,
      error: 'INVALID_DISTANCE',
    });
  });

  it.each([0, -1, NaN])('rejeita duração %p', (durationSeconds) => {
    expect(predictRaceTimes({ distanceKm: 5, durationSeconds })).toEqual({
      ok: false,
      error: 'INVALID_DURATION',
    });
  });

  it.each([0, -1, NaN])('rejeita expoente %p', (exponent) => {
    expect(predictRaceTimes({ distanceKm: 5, durationSeconds: 1500 }, { exponent })).toEqual({
      ok: false,
      error: 'INVALID_EXPONENT',
    });
  });
});
