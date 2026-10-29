import { exportFileName, workoutsToCsv, workoutsToJson } from '../export';
import type { Workout } from '../workout';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

let seq = 0;
function workout(date: Date, overrides: Partial<Workout> = {}): Workout {
  return {
    id: `w${++seq}`,
    date: date.toISOString(),
    distanceMeters: 5000,
    durationSeconds: 1500,
    terrain: 'rua',
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

const BOM = '﻿';
const rows = (csv: string) => csv.replace(BOM, '').split('\r\n');

describe('workoutsToCsv', () => {
  it('começa com BOM para o Excel reconhecer UTF-8 e usa ; como separador', () => {
    const csv = workoutsToCsv([]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(rows(csv)[0]).toBe(
      'data;hora;distancia_km;tempo;tempo_segundos;pace_min_km;velocidade_kmh;terreno;rpe;nota;tenis',
    );
  });

  it('formata a linha com vírgula decimal e unidades canônicas', () => {
    const csv = workoutsToCsv([
      workout(local(2026, 10, 29, 7, 5), {
        distanceMeters: 10000,
        durationSeconds: 3125,
        terrain: 'pista',
        rpe: 8,
        note: 'Tiros',
      }),
    ]);
    expect(rows(csv)[1]).toBe('2026-10-29;07:05;10,00;52:05;3125;5:13;11,52;Pista;8;Tiros;');
  });

  it('deixa RPE e nota vazios quando ausentes', () => {
    const csv = workoutsToCsv([workout(local(2026, 10, 29, 7))]);
    expect(rows(csv)[1]).toBe('2026-10-29;07:00;5,00;25:00;1500;5:00;12,00;Rua;;;');
  });

  it('ordena do mais antigo para o mais recente e ignora removidos', () => {
    const csv = workoutsToCsv([
      workout(local(2026, 10, 29), { distanceMeters: 3000 }),
      workout(local(2026, 10, 27), { distanceMeters: 1000 }),
      workout(local(2026, 10, 28), { distanceMeters: 2000, deletedAt: local(2026, 10, 29).toISOString() }),
    ]);
    expect(rows(csv).slice(1).map((r) => r.split(';')[2])).toEqual(['1,00', '3,00']);
  });

  it('escapa ;, aspas e quebras de linha na nota', () => {
    const csv = workoutsToCsv([workout(local(2026, 10, 29), { note: 'Vento; "forte"\nsubida' })]);
    expect(csv.replace(BOM, '')).toContain(';"Vento; ""forte""\nsubida";');
  });

  it.each(['=1+1', '+5', '-SOMA(A1)', '@cmd'])('neutraliza fórmula na nota "%s"', (note) => {
    const csv = workoutsToCsv([workout(local(2026, 10, 29), { note })]);
    expect(rows(csv)[1].endsWith(`;'${note};`)).toBe(true);
  });
});

describe('workoutsToJson', () => {
  it('gera JSON versionado só com treinos ativos e sem deletedAt', () => {
    const active = workout(local(2026, 10, 29), { rpe: 6 });
    const removed = workout(local(2026, 10, 28), { deletedAt: local(2026, 10, 29).toISOString() });
    const exportedAt = new Date('2026-10-29T12:00:00.000Z');

    const parsed = JSON.parse(workoutsToJson([active, removed], exportedAt));

    expect(parsed).toEqual({
      app: 'PaceFlow',
      schemaVersion: 2,
      exportedAt: '2026-10-29T12:00:00.000Z',
      units: { distance: 'meters', duration: 'seconds' },
      workouts: [
        {
          id: active.id,
          date: active.date,
          distanceMeters: 5000,
          durationSeconds: 1500,
          terrain: 'rua',
          rpe: 6,
          createdAt: active.createdAt,
          updatedAt: active.updatedAt,
        },
      ],
      shoes: [],
    });
  });

  it('ordena do mais antigo para o mais recente', () => {
    const json = workoutsToJson([workout(local(2026, 10, 29)), workout(local(2026, 10, 27))], new Date());
    const dates = JSON.parse(json).workouts.map((w: Workout) => w.date);
    expect(dates).toEqual([...dates].sort());
  });
});

describe('exportFileName', () => {
  it('usa a data local no nome', () => {
    expect(exportFileName('csv', local(2026, 10, 29, 23, 30))).toBe('paceflow-treinos-2026-10-29.csv');
    expect(exportFileName('json', local(2026, 1, 5))).toBe('paceflow-treinos-2026-01-05.json');
  });
});

describe('backup com tênis', () => {
  const shoe = {
    id: 'shoe-1',
    name: 'Pegasus; 41',
    initialMeters: 0,
    limitMeters: 700_000,
    retiredAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
  };

  it('CSV mostra o nome do tênis (escapado)', () => {
    const csv = workoutsToCsv([workout(local(2026, 10, 29), { shoeId: 'shoe-1' })], [shoe]);
    expect(rows(csv)[1].endsWith(';"Pegasus; 41"')).toBe(true);
  });

  it('JSON leva os tênis ativos e o shoeId dos treinos', () => {
    const parsed = JSON.parse(
      workoutsToJson([workout(local(2026, 10, 29), { shoeId: 'shoe-1' })], new Date(), [
        shoe,
        { ...shoe, id: 'gone', deletedAt: '2026-10-02T00:00:00.000Z' },
      ]),
    );
    expect(parsed.workouts[0].shoeId).toBe('shoe-1');
    expect(parsed.shoes).toEqual([
      {
        id: 'shoe-1',
        name: 'Pegasus; 41',
        initialMeters: 0,
        limitMeters: 700_000,
        retiredAt: null,
        createdAt: shoe.createdAt,
        updatedAt: shoe.updatedAt,
      },
    ]);
  });
});

