import { type Result, err, ok } from './result';

export type ParseDurationError = 'INVALID_FORMAT';

// Horas/minutos iniciais sem limite; demais partes com 1–2 dígitos (< 60).
// Só a última parte (segundos) aceita fração, para tiros de pista.
const DURATION_PATTERN = /^(\d+):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d+))?$/;

/** Converte "mm:ss" ou "h:mm:ss" (segundos podem ter fração) em segundos. */
export function parseDuration(input: string): Result<number, ParseDurationError> {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) return err('INVALID_FORMAT');

  const [, first, second, third, fraction] = match;
  const fractionSeconds = fraction ? Number(`0.${fraction}`) : 0;

  if (third === undefined) {
    const minutes = Number(first);
    const seconds = Number(second);
    if (seconds >= 60) return err('INVALID_FORMAT');
    return ok(minutes * 60 + seconds + fractionSeconds);
  }

  const hours = Number(first);
  const minutes = Number(second);
  const seconds = Number(third);
  if (minutes >= 60 || seconds >= 60) return err('INVALID_FORMAT');
  return ok(hours * 3600 + minutes * 60 + seconds + fractionSeconds);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Formata segundos como "m:ss" ou "h:mm:ss". Arredonda o total para o segundo
 * mais próximo antes de decompor, então nunca produz ":60".
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

const plural = (n: number, singular: string, pluralForm: string): string =>
  `${n} ${n === 1 ? singular : pluralForm}`;

/** Versão por extenso para leitores de tela, ex.: "5 minutos e 30 segundos". */
export function spokenDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '';

  const rounded = Math.round(totalSeconds);
  if (rounded === 0) return '0 segundos';

  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const parts = [
    hours > 0 && plural(hours, 'hora', 'horas'),
    minutes > 0 && plural(minutes, 'minuto', 'minutos'),
    seconds > 0 && plural(seconds, 'segundo', 'segundos'),
  ].filter((p): p is string => Boolean(p));

  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}
