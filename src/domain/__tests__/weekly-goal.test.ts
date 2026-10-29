import { goalProgress } from '../weekly-goal';

describe('goalProgress', () => {
  it('calcula proporção, percentual e o que falta', () => {
    expect(goalProgress(12400, 20000)).toEqual({ ratio: 0.62, percent: 62, remainingMeters: 7600, reached: false });
  });

  it('limita a barra em 100%, mas mantém o percentual real', () => {
    expect(goalProgress(25000, 20000)).toEqual({ ratio: 1, percent: 125, remainingMeters: 0, reached: true });
  });

  it('meta exata conta como batida', () => {
    expect(goalProgress(20000, 20000).reached).toBe(true);
  });

  it('semana vazia', () => {
    expect(goalProgress(0, 20000)).toEqual({ ratio: 0, percent: 0, remainingMeters: 20000, reached: false });
  });
});
