import { parseTime } from '../../reminders';
import { parseDuration } from '../time-format';
import { CLOCK_DIGITS, DURATION_DIGITS, maskTime, nextMaskedTime } from '../time-mask';

describe('maskTime', () => {
  it.each([
    ['', ''],
    ['2', '2'],
    ['92', '92'],
    ['250', '2:50'],
    ['2500', '25:00'],
    ['14500', '1:45:00'],
    ['105930', '10:59:30'],
    ['0500', '5:00'],
    ['00', '00'],
    ['000', '0:00'],
    ['045', '0:45'],
    ['0030', '0:30'],
    ['25:00', '25:00'],
    ['1:45:00', '1:45:00'],
    ['2a5 0-0', '25:00'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(maskTime(input, DURATION_DIGITS)).toBe(expected);
  });

  it('corta no limite de dígitos', () => {
    expect(maskTime('1234567', DURATION_DIGITS)).toBe('12:34:56');
    expect(maskTime('19305', CLOCK_DIGITS)).toBe('19:30');
  });

  it('gera texto que os parsers entendem', () => {
    expect(parseDuration(maskTime('2500', DURATION_DIGITS))).toEqual({ ok: true, value: 1500 });
    expect(parseDuration(maskTime('14500', DURATION_DIGITS))).toEqual({ ok: true, value: 6300 });
    expect(parseTime(maskTime('0545', CLOCK_DIGITS))).toBe('05:45');
    expect(parseTime(maskTime('1930', CLOCK_DIGITS))).toBe('19:30');
    expect(parseTime(maskTime('0030', CLOCK_DIGITS))).toBe('00:30');
    expect(parseDuration(maskTime('045', DURATION_DIGITS))).toEqual({ ok: true, value: 45 });
  });
});

describe('nextMaskedTime', () => {
  it('formata a cada dígito digitado', () => {
    let value = '';
    for (const digit of '14500') value = nextMaskedTime(value, value + digit, DURATION_DIGITS);
    expect(value).toBe('1:45:00');
  });

  it('backspace no fim tira o último dígito', () => {
    expect(nextMaskedTime('25:00', '25:0', DURATION_DIGITS)).toBe('2:50');
  });

  it('apagar só o ":" também tira o último dígito', () => {
    expect(nextMaskedTime('25:00', '2500', DURATION_DIGITS)).toBe('2:50');
    expect(nextMaskedTime('2:50', '250', DURATION_DIGITS)).toBe('25');
  });

  it('colar um tempo já formatado mantém o valor', () => {
    expect(nextMaskedTime('', '1:45:00', DURATION_DIGITS)).toBe('1:45:00');
  });
});
