import { type Result, err, ok } from './result';

// Aceita vírgula ou ponto como separador decimal; sem separador de milhar.
const DISTANCE_PATTERN = /^(\d*)(?:[.,](\d+))?$/;

export function parseDistance(input: string): Result<number, 'INVALID_FORMAT'> {
  const match = DISTANCE_PATTERN.exec(input.trim());
  if (!match || (!match[1] && !match[2])) return err('INVALID_FORMAT');
  return ok(Number(`${match[1] || '0'}.${match[2] ?? '0'}`));
}
