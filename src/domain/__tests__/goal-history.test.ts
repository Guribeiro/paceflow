import { type GoalChange, goalForWeek, parseGoalHistory, recordGoal } from '../goal-history';

describe('parseGoalHistory', () => {
  it('aceita a lista vazia', () => {
    expect(parseGoalHistory([])).toEqual([]);
  });

  it('aceita metas em metros e semanas sem meta, ordenando pela semana', () => {
    expect(
      parseGoalHistory([
        { week: '2026-10-19', meters: null },
        { week: '0000-01-01', meters: 10_000 },
        { week: '2026-10-05', meters: 20_000 },
      ]),
    ).toEqual([
      { week: '0000-01-01', meters: 10_000 },
      { week: '2026-10-05', meters: 20_000 },
      { week: '2026-10-19', meters: null },
    ]);
  });

  it.each([
    ['não é lista', { week: '2026-10-05', meters: 10_000 }],
    ['nulo', null],
    ['item nulo', [null]],
    ['semana fora do formato', [{ week: '5/10/2026', meters: 10_000 }]],
    ['semana ausente', [{ meters: 10_000 }]],
    ['meta zero', [{ week: '2026-10-05', meters: 0 }]],
    ['meta negativa', [{ week: '2026-10-05', meters: -1 }]],
    ['meta infinita', [{ week: '2026-10-05', meters: Infinity }]],
    ['meta NaN', [{ week: '2026-10-05', meters: NaN }]],
    ['meta em texto', [{ week: '2026-10-05', meters: '10000' }]],
    ['meta ausente', [{ week: '2026-10-05' }]],
    ['um item inválido no meio', [{ week: '2026-10-05', meters: 10_000 }, { week: 'x', meters: 1 }]],
  ])('rejeita %s', (_, value) => {
    expect(parseGoalHistory(value)).toBeNull();
  });

  it('não altera a lista recebida ao ordenar', () => {
    const raw = [
      { week: '2026-10-19', meters: 1 },
      { week: '2026-10-05', meters: 2 },
    ];
    parseGoalHistory(raw);
    expect(raw.map((c) => c.week)).toEqual(['2026-10-19', '2026-10-05']);
  });
});

describe('recordGoal', () => {
  it('no primeiro registro, a meta anterior passa a valer para todo o passado', () => {
    expect(recordGoal([], '2026-11-02', 20_000, 10_000)).toEqual([
      { week: '0000-01-01', meters: 10_000 },
      { week: '2026-11-02', meters: 20_000 },
    ]);
  });

  it('sem meta anterior, o passado fica sem meta', () => {
    expect(recordGoal([], '2026-11-02', 20_000, null)).toEqual([
      { week: '0000-01-01', meters: null },
      { week: '2026-11-02', meters: 20_000 },
    ]);
  });

  it('depois do primeiro, ignora a meta anterior e acrescenta a mudança em ordem', () => {
    const history: GoalChange[] = [
      { week: '0000-01-01', meters: 10_000 },
      { week: '2026-11-02', meters: 20_000 },
    ];
    expect(recordGoal(history, '2026-11-16', null, 99_999)).toEqual([...history, { week: '2026-11-16', meters: null }]);
  });

  it('mudar de novo na mesma semana substitui a mudança anterior', () => {
    const history: GoalChange[] = [
      { week: '0000-01-01', meters: 10_000 },
      { week: '2026-10-26', meters: 15_000 },
      { week: '2026-11-02', meters: 20_000 },
    ];
    expect(recordGoal(history, '2026-10-26', 30_000, 20_000)).toEqual([
      { week: '0000-01-01', meters: 10_000 },
      { week: '2026-10-26', meters: 30_000 },
      { week: '2026-11-02', meters: 20_000 },
    ]);
  });

  it('não altera o histórico recebido', () => {
    const history: GoalChange[] = [{ week: '0000-01-01', meters: 10_000 }];
    recordGoal(history, '2026-11-02', 20_000, 10_000);
    expect(history).toEqual([{ week: '0000-01-01', meters: 10_000 }]);
  });
});

describe('goalForWeek', () => {
  const history: GoalChange[] = [
    { week: '2026-10-05', meters: 10_000 },
    { week: '2026-10-19', meters: 20_000 },
    { week: '2026-11-02', meters: null },
  ];

  it('sem histórico, vale a meta atual', () => {
    expect(goalForWeek([], '2026-10-12', 15_000)).toBe(15_000);
    expect(goalForWeek([], '2026-10-12', null)).toBeNull();
  });

  it('usa a última mudança até a semana, inclusive a da própria semana', () => {
    expect(goalForWeek(history, '2026-10-05', 1)).toBe(10_000);
    expect(goalForWeek(history, '2026-10-12', 1)).toBe(10_000);
    expect(goalForWeek(history, '2026-10-19', 1)).toBe(20_000);
    expect(goalForWeek(history, '2026-10-26', 1)).toBe(20_000);
    expect(goalForWeek(history, '2026-11-02', 1)).toBeNull();
    expect(goalForWeek(history, '2027-01-04', 1)).toBeNull();
  });

  it('antes do histórico, vale a primeira meta registrada', () => {
    expect(goalForWeek(history, '2026-09-28', 1)).toBe(10_000);
  });

  it('o semeado de recordGoal cobre todas as semanas passadas', () => {
    const seeded = recordGoal([], '2026-11-02', 20_000, 10_000);
    expect(goalForWeek(seeded, '2020-01-06', null)).toBe(10_000);
    expect(goalForWeek(seeded, '2026-10-26', null)).toBe(10_000);
    expect(goalForWeek(seeded, '2026-11-02', null)).toBe(20_000);
  });
});
