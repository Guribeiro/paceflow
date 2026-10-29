import { formatDuration } from './pace/time-format';
import { TERRAIN_LABELS, type Workout } from './workout';

export type ExportFormat = 'csv' | 'json';

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
};

const EXPORT_SCHEMA_VERSION = 1;

const pad2 = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const decimal = (n: number) => n.toFixed(2).replace('.', ',');

function activeChronological(workouts: readonly Workout[]): Workout[] {
  return workouts
    .filter((w) => w.deletedAt === null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/**
 * Escapa um campo CSV (RFC 4180) e neutraliza fórmulas: planilhas executam
 * células que começam com = + - @, então o texto livre recebe um apóstrofo.
 */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_HEADER = [
  'data',
  'hora',
  'distancia_km',
  'tempo',
  'tempo_segundos',
  'pace_min_km',
  'velocidade_kmh',
  'terreno',
  'rpe',
  'nota',
];

/**
 * CSV no padrão do Excel em pt-BR: separador ";", vírgula decimal, CRLF e BOM
 * UTF-8 para os acentos aparecerem corretamente.
 */
export function workoutsToCsv(workouts: readonly Workout[]): string {
  const lines = activeChronological(workouts).map((w) => {
    const date = new Date(w.date);
    const km = w.distanceMeters / 1000;
    return [
      localDate(date),
      localTime(date),
      decimal(km),
      formatDuration(w.durationSeconds),
      String(Math.round(w.durationSeconds)),
      formatDuration(w.durationSeconds / km),
      decimal(km / (w.durationSeconds / 3600)),
      TERRAIN_LABELS[w.terrain],
      w.rpe !== undefined ? String(w.rpe) : '',
      csvField(w.note ?? ''),
    ].join(';');
  });

  return `﻿${[CSV_HEADER.join(';'), ...lines].join('\r\n')}`;
}

/** JSON versionado em unidades canônicas, para backup ou análise por código. */
export function workoutsToJson(workouts: readonly Workout[], exportedAt: Date = new Date()): string {
  const records = activeChronological(workouts).map(({ deletedAt: _deleted, ...rest }) => rest);
  return JSON.stringify(
    {
      app: 'PaceFlow',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      units: { distance: 'meters', duration: 'seconds' },
      workouts: records,
    },
    null,
    2,
  );
}

export function exportFileName(format: ExportFormat, now: Date = new Date()): string {
  return `paceflow-treinos-${localDate(now)}.${format}`;
}
