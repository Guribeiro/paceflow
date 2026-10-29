import { formatDuration, parseDuration, spokenDuration } from '../time-format';

describe('parseDuration', () => {
  it.each([
    ['25:00', 1500],
    ['0:90', null],
    ['4:05', 245],
    ['1:29.5', 89.5],
    ['1:05:30', 3930],
    ['3:00:00', 10800],
    ['100:00', 6000],
    ['0:00', 0],
  ])('"%s" → %p', (input, expected) => {
    const result = parseDuration(input);
    if (expected === null) {
      expect(result).toEqual({ ok: false, error: 'INVALID_FORMAT' });
    } else {
      expect(result).toEqual({ ok: true, value: expected });
    }
  });

  it('aceita espaços nas bordas', () => {
    expect(parseDuration(' 25:00 ')).toEqual({ ok: true, value: 1500 });
  });

  it.each(['', 'abc', '5:75', '1:60:00', '25', '1:2:3:4', '-5:00', '5:-1', '5:', ':30', '1e2:00', '5:3a'])(
    'rejeita "%s"',
    (input) => {
      expect(parseDuration(input)).toEqual({ ok: false, error: 'INVALID_FORMAT' });
    },
  );
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [245, '4:05'],
    [1500, '25:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3930, '1:05:30'],
    [36000, '10:00:00'],
  ])('%p s → "%s"', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('arredonda para o segundo mais próximo sem gerar :60', () => {
    expect(formatDuration(299.6)).toBe('5:00');
    expect(formatDuration(299.4)).toBe('4:59');
    expect(formatDuration(3599.5)).toBe('1:00:00');
  });

  it('retorna placeholder para valores inválidos', () => {
    expect(formatDuration(NaN)).toBe('--:--');
    expect(formatDuration(Infinity)).toBe('--:--');
    expect(formatDuration(-1)).toBe('--:--');
  });
});

describe('spokenDuration', () => {
  it.each([
    [0, '0 segundos'],
    [1, '1 segundo'],
    [60, '1 minuto'],
    [330, '5 minutos e 30 segundos'],
    [3600, '1 hora'],
    [3661, '1 hora, 1 minuto e 1 segundo'],
    [7230, '2 horas e 30 segundos'],
    [299.6, '5 minutos'],
  ])('%p s → "%s"', (seconds, expected) => {
    expect(spokenDuration(seconds)).toBe(expected);
  });

  it('retorna texto vazio para valores inválidos', () => {
    expect(spokenDuration(NaN)).toBe('');
  });
});
