import type { Workout } from '../workout';
import { buildWeekWidgetProps } from '../widget-snapshot';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

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

const now = local(2026, 10, 29, 12); // quinta; a semana começa em 26/10

describe('buildWeekWidgetProps', () => {
  it('semana vazia e sem treinos', () => {
    expect(buildWeekWidgetProps([], 'km', now)).toEqual({
      weekLabel: 'Semana de 26/10',
      distance: '0,00',
      unit: 'km',
      count: 'Nenhum treino',
      lastPace: null,
    });
  });

  it('soma a semana e mostra o pace do treino mais recente', () => {
    const props = buildWeekWidgetProps(
      [
        workout(local(2026, 10, 27, 7), { distanceMeters: 10000, durationSeconds: 3000 }), // 5:00/km
        workout(local(2026, 10, 28, 7), { distanceMeters: 4000, durationSeconds: 1080 }), // 4:30/km
      ],
      'km',
      now,
    );
    expect(props).toMatchObject({ distance: '14,00', count: '2 treinos', lastPace: '4:30/km' });
  });

  it('usa singular para um treino', () => {
    expect(buildWeekWidgetProps([workout(local(2026, 10, 27))], 'km', now).count).toBe('1 treino');
  });

  it('converte distância e pace para milhas', () => {
    const props = buildWeekWidgetProps(
      [workout(local(2026, 10, 27), { distanceMeters: 1609.344, durationSeconds: 480 })],
      'mi',
      now,
    );
    expect(props).toMatchObject({ distance: '1,00', unit: 'mi', lastPace: '8:00/mi' });
  });

  it('último pace vem de semana anterior se a atual estiver vazia', () => {
    const props = buildWeekWidgetProps([workout(local(2026, 10, 20), { durationSeconds: 1350 })], 'km', now);
    expect(props).toMatchObject({ distance: '0,00', count: 'Nenhum treino', lastPace: '4:30/km' });
  });

  it('ignora treinos removidos', () => {
    const props = buildWeekWidgetProps(
      [workout(local(2026, 10, 27), { deletedAt: now.toISOString() })],
      'km',
      now,
    );
    expect(props).toMatchObject({ count: 'Nenhum treino', lastPace: null });
  });

  it('o rótulo acompanha a virada de semana', () => {
    expect(buildWeekWidgetProps([], 'km', local(2026, 11, 2, 8)).weekLabel).toBe('Semana de 02/11');
  });
});
