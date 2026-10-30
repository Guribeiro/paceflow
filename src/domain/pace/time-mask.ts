/** Dígitos de uma duração: até h:mm:ss com duas casas na hora (99:59:59). */
export const DURATION_DIGITS = 6;
/** Dígitos de um horário hh:mm. */
export const CLOCK_DIGITS = 4;

const digitsOf = (text: string): string => text.replace(/\D/g, '');

/**
 * Máscara de tempo preenchida da direita para a esquerda: os dois últimos
 * dígitos são sempre a menor unidade. "2500" → "25:00", "14500" → "1:45:00".
 * Até dois dígitos não ganham ":", então "92" continua sendo só "92". Zeros à
 * esquerda saem só enquanto sobram 3 dígitos: "0500" → "5:00", "030" → "0:30".
 */
export function maskTime(input: string, maxDigits: number): string {
  const digits = digitsOf(input).slice(0, maxDigits).replace(/^0+(?=\d{3})/, '');
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 2) {
    groups.unshift(digits.slice(Math.max(0, end - 2), end));
  }
  return groups.join(':');
}

/**
 * Próximo valor do campo mascarado. Apagar só um ":" não mudaria os dígitos e o
 * campo pareceria travado; nesse caso o último dígito sai junto.
 */
export function nextMaskedTime(previous: string, input: string, maxDigits: number): string {
  const digits = digitsOf(input);
  const erasedSeparator = input.length < previous.length && digits === digitsOf(previous);
  return maskTime(erasedSeparator ? digits.slice(0, -1) : digits, maxDigits);
}
