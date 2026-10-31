import {
  type LoadStatus,
  defaultRpe,
  formatRatio,
  loadMessage,
  loadStatus,
  loadZone,
  sessionLoad,
  weeklyLoads,
} from '../training-load';
import type { Workout } from '../workout';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 7, min = 0) => new Date(y, m - 1, d, h, min);

let seq = 0;
const workout = (date: Date, minutes = 30, overrides: Partial<Workout> = {}): Workout => ({
  id: `w${++seq}`,
  date: date.toISOString(),
  distanceMeters: 5_000,
  durationSeconds: minutes * 60,
  terrain: 'rua',
  rpe: 5,
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  deletedAt: null,
  ...overrides,
});

const noRpe = (date: Date, minutes = 30) => workout(date, minutes, { rpe: undefined });
const deleted = (date: Date, minutes = 30) => workout(date, minutes, { deletedAt: date.toISOString() });

// Quarta-feira, 04/11/2026, 10h; a semana começa na segunda 02/11.
const NOW = local(2026, 11, 4, 10);
// Primeiro treino bem antes da janela de 28 dias: histórico suficiente.
const OLD = local(2026, 8, 1);

describe('defaultRpe', () => {
  it('sem RPE informado, usa 5', () => {
    expect(defaultRpe([])).toBe(5);
    expect(defaultRpe([noRpe(NOW), noRpe(OLD)])).toBe(5);
  });

  it('é a média dos RPEs informados, ignorando treinos sem RPE', () => {
    expect(defaultRpe([workout(NOW, 30, { rpe: 4 }), workout(OLD, 30, { rpe: 7 }), noRpe(NOW)])).toBe(5.5);
  });

  it('arredonda para uma casa', () => {
    const rpes = [6, 6, 7].map((rpe) => workout(NOW, 30, { rpe }));
    expect(defaultRpe(rpes)).toBe(6.3);
    const up = [7, 7, 8].map((rpe) => workout(NOW, 30, { rpe }));
    expect(defaultRpe(up)).toBe(7.3);
  });

  it('ignora treinos excluídos', () => {
    expect(defaultRpe([workout(NOW, 30, { rpe: 4 }), workout(NOW, 30, { rpe: 10, deletedAt: NOW.toISOString() })])).toBe(4);
    expect(defaultRpe([workout(NOW, 30, { rpe: 10, deletedAt: NOW.toISOString() })])).toBe(5);
  });
});

describe('sessionLoad', () => {
  it('é o RPE vezes os minutos', () => {
    expect(sessionLoad(workout(NOW, 30, { rpe: 6 }), 5)).toBe(180);
    expect(sessionLoad(workout(NOW, 30, { rpe: 6, durationSeconds: 90 }), 5)).toBe(9);
  });

  it('sem RPE, usa o RPE de reserva', () => {
    expect(sessionLoad(noRpe(NOW, 30), 5.5)).toBe(165);
  });
});

describe('loadZone', () => {
  it('separa as faixas nos limites de 0,8, 1,3 e 1,5', () => {
    expect([0, 0.79, 0.8, 1, 1.3, 1.31, 1.5, 1.51, 3].map(loadZone)).toEqual([
      'baixa',
      'baixa',
      'ideal',
      'ideal',
      'ideal',
      'atencao',
      'atencao',
      'alta',
      'alta',
    ]);
  });
});

describe('loadStatus', () => {
  it('sem treinos: histórico insuficiente e tudo zerado', () => {
    expect(loadStatus([], NOW)).toEqual({
      acute: 0,
      chronic: 0,
      ratio: null,
      zone: 'insuficiente',
      estimated: 0,
      fallbackRpe: 5,
    });
  });

  it('últimos 7 dias contam de 6 dias atrás até hoje; os 28 de 27 dias atrás até hoje', () => {
    const workouts = [
      workout(OLD, 80), // fora das duas janelas; só garante o histórico
      workout(local(2026, 10, 7, 23, 59), 70), // 28 dias atrás: fora
      workout(local(2026, 10, 8, 0, 0), 10), // 27 dias atrás: só nos 28
      workout(local(2026, 10, 28, 23, 59), 20), // 7 dias atrás: só nos 28
      workout(local(2026, 10, 29, 0, 0), 40), // 6 dias atrás: nos 7
      workout(local(2026, 11, 4, 9), 60), // hoje: nos 7
    ];
    const acute = 5 * (40 + 60);
    const chronic = (5 * (10 + 20 + 40 + 60)) / 4;
    expect(loadStatus(workouts, NOW)).toEqual({
      acute,
      chronic,
      ratio: acute / chronic,
      zone: 'alta',
      estimated: 0,
      fallbackRpe: 5,
    });
  });

  it('com carga estável, fica na zona ideal', () => {
    // Um treino igual por semana nas últimas 4 semanas: 7 dias = média.
    const workouts = [workout(OLD, 30), ...[0, 7, 14, 21].map((days) => workout(local(2026, 11, 4 - days, 8)))];
    expect(loadStatus(workouts, NOW)).toMatchObject({ acute: 150, chronic: 150, ratio: 1, zone: 'ideal' });
  });

  it('ignora treinos excluídos e futuros', () => {
    const base = [workout(OLD), workout(local(2026, 10, 20), 30)];
    const withIgnored = [
      ...base,
      deleted(local(2026, 11, 3), 120),
      workout(local(2026, 11, 4, 11), 120, { rpe: 10 }), // hoje, mas depois de agora
      workout(local(2026, 11, 6), 120, { rpe: 10 }),
    ];
    expect(loadStatus(withIgnored, NOW)).toEqual(loadStatus(base, NOW));
    expect(loadStatus(withIgnored, NOW)).toMatchObject({ acute: 0, chronic: 37.5, ratio: 0, zone: 'baixa', fallbackRpe: 5 });
  });

  it('um treino excluído não conta como histórico', () => {
    const workouts = [deleted(OLD), workout(local(2026, 11, 3))];
    expect(loadStatus(workouts, NOW)).toMatchObject({ ratio: null, zone: 'insuficiente' });
  });

  describe('histórico mínimo de 21 dias', () => {
    const recent = workout(local(2026, 11, 3), 30);

    it('primeiro treino há 20 dias: insuficiente, mas mostra as cargas', () => {
      expect(loadStatus([workout(local(2026, 10, 15)), recent], NOW)).toEqual({
        acute: 150,
        chronic: 75,
        ratio: null,
        zone: 'insuficiente',
        estimated: 0,
        fallbackRpe: 5,
      });
    });

    it('primeiro treino à meia-noite de 20 dias atrás: ainda insuficiente', () => {
      expect(loadStatus([workout(local(2026, 10, 15, 0)), recent], NOW)).toMatchObject({ ratio: null, zone: 'insuficiente' });
    });

    it('primeiro treino à meia-noite de 21 dias atrás: já compara', () => {
      expect(loadStatus([workout(local(2026, 10, 14, 0)), recent], NOW)).toMatchObject({ ratio: 2, zone: 'alta' });
    });

    it('primeiro treino há 21 dias, em qualquer hora: já compara', () => {
      expect(loadStatus([workout(local(2026, 10, 14, 23, 59)), recent], NOW)).toMatchObject({ ratio: 2, zone: 'alta' });
    });

    it('primeiro treino há 22 dias: já compara', () => {
      expect(loadStatus([workout(local(2026, 10, 13, 18)), recent], NOW)).toMatchObject({ ratio: 2, zone: 'alta' });
    });

    it('com histórico, mas nada nos últimos 28 dias: insuficiente (média zero)', () => {
      expect(loadStatus([workout(OLD)], NOW)).toEqual({
        acute: 0,
        chronic: 0,
        ratio: null,
        zone: 'insuficiente',
        estimated: 0,
        fallbackRpe: 5,
      });
    });
  });

  it('conta os treinos sem RPE dos últimos 28 dias e usa a média dos RPEs como reserva', () => {
    const workouts = [
      workout(OLD, 30, { rpe: 8 }),
      noRpe(local(2026, 9, 20)), // sem RPE, mas fora dos 28 dias
      workout(local(2026, 10, 20), 30, { rpe: 4 }),
      noRpe(local(2026, 10, 21), 30),
      noRpe(local(2026, 11, 3), 60),
    ];
    // Média dos RPEs (8 e 4) = 6.
    const acute = 6 * 60;
    const chronic = (4 * 30 + 6 * 30 + 6 * 60) / 4;
    expect(loadStatus(workouts, NOW)).toEqual({
      acute,
      chronic,
      ratio: acute / chronic,
      zone: 'alta',
      estimated: 2,
      fallbackRpe: 6,
    });
  });

  describe('horário de verão', () => {
    // As janelas seguem o calendário: subtrair 6×24h da meia-noite cai à 1h
    // do dia certo ao atravessar o fim do horário de verão e perde a madrugada.
    // Só distingue os dois jeitos num fuso com horário de verão nas datas
    // abaixo (America/Sao_Paulo em 2019); rode também com TZ=America/New_York.
    it('atravessa o fim do horário de verão brasileiro de 2019 (17/02)', () => {
      const now = local(2019, 2, 20, 10);
      const workouts = [
        workout(local(2019, 1, 1)),
        workout(local(2019, 2, 14, 0, 30), 40), // 6 dias atrás, de madrugada: nos 7
        workout(local(2019, 2, 13, 23, 30), 20), // 7 dias atrás: fora dos 7
        workout(local(2019, 1, 24, 0, 30), 10), // 27 dias atrás, de madrugada: nos 28
      ];
      expect(loadStatus(workouts, now)).toMatchObject({ acute: 200, chronic: (5 * (40 + 20 + 10)) / 4 });
    });

    it('atravessa o fim do horário de verão dos EUA de 2026 (01/11)', () => {
      const workouts = [workout(OLD), workout(local(2026, 10, 29, 0, 30), 40), workout(local(2026, 10, 28, 23, 30), 20)];
      expect(loadStatus(workouts, NOW)).toMatchObject({ acute: 200 });
    });
  });
});

describe('weeklyLoads', () => {
  const week = (y: number, m: number, d: number, load: number, count: number) => ({
    weekStart: local(y, m, d, 0).toISOString(),
    load,
    count,
  });

  it('soma a carga de segunda a domingo, da semana mais antiga à atual', () => {
    const workouts = [
      workout(local(2026, 10, 18, 23, 59), 100), // domingo antes da primeira semana: fora
      workout(local(2026, 10, 19, 0, 0), 10), // segunda da primeira semana
      workout(local(2026, 10, 25, 23, 59), 20), // domingo da primeira semana
      noRpe(local(2026, 10, 26, 0, 0), 30), // sem RPE: usa a média (5)
      deleted(local(2026, 10, 27), 100),
      workout(local(2026, 11, 4, 9), 40, { rpe: 6 }),
      workout(local(2026, 11, 4, 11), 100), // hoje, depois de agora
    ];
    // RPEs ativos até agora: 5, 5, 5, 6 → 5,3.
    expect(weeklyLoads(workouts, NOW, 3)).toEqual([
      week(2026, 10, 19, 5 * 30, 2),
      week(2026, 10, 26, 5.3 * 30, 1),
      week(2026, 11, 2, 6 * 40, 1),
    ]);
  });

  it('devolve 12 semanas por padrão, mesmo sem treinos', () => {
    const weeks = weeklyLoads([], NOW);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toEqual(week(2026, 8, 17, 0, 0));
    expect(weeks[11]).toEqual(week(2026, 11, 2, 0, 0));
  });

  describe('horário de verão', () => {
    // Mesmo cuidado de streak.test.ts: a segunda vem do calendário, não de 7×24h.
    it('atravessa o fim do horário de verão brasileiro de 2019 (17/02)', () => {
      const now = local(2019, 2, 20, 10);
      const workouts = [workout(local(2019, 2, 11, 0, 30), 10), workout(local(2019, 2, 17, 23, 30), 20)];
      expect(weeklyLoads(workouts, now, 2)).toEqual([week(2019, 2, 11, 5 * 30, 2), week(2019, 2, 18, 0, 0)]);
    });

    it('atravessa o início do horário de verão brasileiro de 2018 (domingo 04/11, sem meia-noite)', () => {
      const now = local(2018, 11, 7, 10);
      const workouts = [
        workout(local(2018, 10, 28, 23, 30), 100), // domingo antes da primeira semana: fora
        workout(local(2018, 11, 4, 12), 10),
        workout(local(2018, 11, 5, 0, 30), 20),
      ];
      expect(weeklyLoads(workouts, now, 2)).toEqual([week(2018, 10, 29, 50, 1), week(2018, 11, 5, 100, 1)]);
    });

    it('atravessa o fim do horário de verão de 2026 (EUA 01/11, Europa 25/10)', () => {
      const workouts = [workout(local(2026, 10, 19, 0, 30), 10), workout(local(2026, 11, 2, 0, 30), 20)];
      expect(weeklyLoads(workouts, NOW, 3)).toEqual([
        week(2026, 10, 19, 50, 1),
        week(2026, 10, 26, 0, 0),
        week(2026, 11, 2, 100, 1),
      ]);
    });
  });
});

describe('formatRatio', () => {
  it('usa vírgula, uma casa e o sinal de vezes', () => {
    expect([1.64, 2, 0.75].map(formatRatio)).toEqual(['1,6×', '2,0×', '0,8×']);
  });
});

describe('loadMessage', () => {
  const status = (zone: LoadStatus['zone'], ratio: number | null): LoadStatus => ({
    acute: 0,
    chronic: 0,
    ratio,
    zone,
    estimated: 0,
    fallbackRpe: 5,
  });

  it('avisa quando a carga entra em atenção', () => {
    expect(loadMessage(status('ideal', 1.2), status('atencao', 1.4))).toEqual({
      text: '⚠️ Carga subindo: 1,4× sua média semanal. Vá com calma.',
      spoken: 'Carga subindo: 1,4 vezes sua média semanal. Vá com calma.',
    });
  });

  it('avisa quando a carga entra na zona alta', () => {
    const expected = {
      text: '⚠️ Carga alta: 1,7× sua média semanal. Pegue leve nos próximos dias.',
      spoken: 'Carga alta: 1,7 vezes sua média semanal. Pegue leve nos próximos dias.',
    };
    expect(loadMessage(status('ideal', 1.2), status('alta', 1.7))).toEqual(expected);
    expect(loadMessage(status('baixa', 0.5), status('alta', 1.7))).toEqual(expected);
    // O treino que completa o histórico já pode levar ao aviso.
    expect(loadMessage(status('insuficiente', null), status('alta', 1.7))).toEqual(expected);
  });

  it('não repete o aviso quem já estava em risco, nem avisa fora dele', () => {
    expect(loadMessage(status('atencao', 1.4), status('alta', 1.7))).toBeNull();
    expect(loadMessage(status('alta', 1.6), status('alta', 1.8))).toBeNull();
    expect(loadMessage(status('atencao', 1.4), status('atencao', 1.45))).toBeNull();
    expect(loadMessage(status('baixa', 0.5), status('ideal', 1))).toBeNull();
    expect(loadMessage(status('insuficiente', null), status('insuficiente', null))).toBeNull();
  });
});
