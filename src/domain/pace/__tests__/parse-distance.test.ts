import { parseDistance } from '../parse-distance';

describe('parseDistance', () => {
  it.each([
    ['5', 5],
    ['21,0975', 21.0975],
    ['0.4', 0.4],
    [' 10 ', 10],
    [',5', 0.5],
  ])('"%s" → %p', (input, expected) => {
    expect(parseDistance(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'abc', '5,5,5', '1.000,5', '-5', '5km', '1e3', ','])('rejeita "%s"', (input) => {
    expect(parseDistance(input)).toEqual({ ok: false, error: 'INVALID_FORMAT' });
  });
});
