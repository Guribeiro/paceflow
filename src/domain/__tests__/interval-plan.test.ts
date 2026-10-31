import {
  DEFAULT_INTERVAL_PLAN,
  type IntervalPlan,
  MAX_REPS,
  describeMeasure,
  describePlan,
  expandPhases,
  parseIntervalPlan,
  parseMeasure,
} from '../interval-plan';

const plan = (change: Partial<IntervalPlan> = {}): IntervalPlan => ({ ...DEFAULT_INTERVAL_PLAN, ...change });

describe('DEFAULT_INTERVAL_PLAN', () => {
  it('é 10 min de aquecimento, 8 × 400 m com 1 min de recuperação e 5 min de desaquecimento, sem alvo', () => {
    expect(DEFAULT_INTERVAL_PLAN).toEqual({
      warmup: { kind: 'time', seconds: 600 },
      reps: 8,
      work: { kind: 'distance', meters: 400 },
      recovery: { kind: 'time', seconds: 60 },
      cooldown: { kind: 'time', seconds: 300 },
      targetSecondsPerKm: null,
    });
  });
});

describe('expandPhases', () => {
  it('põe aquecimento, tiros intercalados com recuperação e desaquecimento, sem recuperação depois do último tiro', () => {
    const work = { kind: 'distance', meters: 400 } as const;
    const rec = { kind: 'time', seconds: 60 } as const;
    expect(expandPhases(plan({ reps: 3 }))).toEqual([
      { kind: 'warmup', measure: { kind: 'time', seconds: 600 } },
      { kind: 'work', measure: work, rep: 1 },
      { kind: 'recovery', measure: rec, rep: 1 },
      { kind: 'work', measure: work, rep: 2 },
      { kind: 'recovery', measure: rec, rep: 2 },
      { kind: 'work', measure: work, rep: 3 },
      { kind: 'cooldown', measure: { kind: 'time', seconds: 300 } },
    ]);
  });

  it('sem aquecimento, recuperação e desaquecimento, são só os tiros', () => {
    const phases = expandPhases(plan({ warmup: null, recovery: null, cooldown: null, reps: 3 }));
    expect(phases.map((p) => `${p.kind}${p.rep ?? ''}`)).toEqual(['work1', 'work2', 'work3']);
  });

  it('com um tiro só, não há recuperação', () => {
    const phases = expandPhases(plan({ reps: 1 }));
    expect(phases.map((p) => p.kind)).toEqual(['warmup', 'work', 'cooldown']);
  });
});

describe('parseMeasure', () => {
  it.each([
    [{ kind: 'distance', meters: 50 }],
    [{ kind: 'distance', meters: 10_000 }],
    [{ kind: 'time', seconds: 10 }],
    [{ kind: 'time', seconds: 1800 }],
  ])('aceita os limites: %j', (measure) => {
    expect(parseMeasure(measure)).toEqual(measure);
  });

  it('descarta campos extras', () => {
    expect(parseMeasure({ kind: 'distance', meters: 400, seconds: 3 })).toEqual({ kind: 'distance', meters: 400 });
  });

  it.each([
    ['49 m', { kind: 'distance', meters: 49 }],
    ['10001 m', { kind: 'distance', meters: 10_001 }],
    ['9 s', { kind: 'time', seconds: 9 }],
    ['30 min e 1 s', { kind: 'time', seconds: 1801 }],
    ['NaN', { kind: 'distance', meters: Number.NaN }],
    ['metros em texto', { kind: 'distance', meters: '400' }],
    ['tempo com metros', { kind: 'time', meters: 400 }],
    ['tipo desconhecido', { kind: 'voltas', meters: 400 }],
    ['null', null],
    ['número', 400],
  ])('recusa %s', (_, value) => {
    expect(parseMeasure(value)).toBeNull();
  });
});

describe('parseIntervalPlan', () => {
  it('aceita o plano padrão e um com alvo e sem fases opcionais', () => {
    expect(parseIntervalPlan(DEFAULT_INTERVAL_PLAN)).toEqual(DEFAULT_INTERVAL_PLAN);
    const minimal = plan({ warmup: null, recovery: null, cooldown: null, reps: 1, targetSecondsPerKm: 230 });
    expect(parseIntervalPlan(minimal)).toEqual(minimal);
  });

  it(`aceita de 1 a ${MAX_REPS} tiros`, () => {
    expect(parseIntervalPlan(plan({ reps: 1 }))?.reps).toBe(1);
    expect(parseIntervalPlan(plan({ reps: MAX_REPS }))?.reps).toBe(MAX_REPS);
  });

  it.each<[string, unknown]>([
    ['0 tiros', plan({ reps: 0 })],
    ['51 tiros', plan({ reps: 51 })],
    ['tiros fracionados', plan({ reps: 2.5 })],
    ['tiro fora dos limites', plan({ work: { kind: 'distance', meters: 20 } })],
    ['tiro ausente', { ...plan(), work: null }],
    ['aquecimento inválido', { ...plan(), warmup: { kind: 'time', seconds: 5 } }],
    ['recuperação ausente (undefined)', { ...plan(), recovery: undefined }],
    ['desaquecimento inválido', { ...plan(), cooldown: 'longo' }],
    ['alvo zero', plan({ targetSecondsPerKm: 0 })],
    ['alvo negativo', plan({ targetSecondsPerKm: -230 })],
    ['alvo infinito', plan({ targetSecondsPerKm: Number.POSITIVE_INFINITY })],
    ['alvo ausente', { ...plan(), targetSecondsPerKm: undefined }],
    ['valor que não é objeto', 'plano'],
    ['null', null],
  ])('recusa %s', (_, value) => {
    expect(parseIntervalPlan(value)).toBeNull();
  });
});

describe('describeMeasure', () => {
  it.each<[Parameters<typeof describeMeasure>[0], string]>([
    [{ kind: 'distance', meters: 400 }, '400 m'],
    [{ kind: 'distance', meters: 1000 }, '1 km'],
    [{ kind: 'distance', meters: 1500 }, '1,5 km'],
    [{ kind: 'time', seconds: 30 }, '30 s'],
    [{ kind: 'time', seconds: 120 }, '2 min'],
    [{ kind: 'time', seconds: 90 }, '1:30 min'],
  ])('%j vira "%s"', (measure, text) => {
    expect(describeMeasure(measure)).toBe(text);
  });
});

describe('describePlan', () => {
  it('descreve o plano padrão', () => {
    expect(describePlan(DEFAULT_INTERVAL_PLAN, 'km')).toBe(
      'Aquecimento 10 min · 8 × 400 m (rec. 1 min) · Desaquecimento 5 min',
    );
  });

  it('inclui o alvo na unidade escolhida', () => {
    const withTarget = plan({ targetSecondsPerKm: 230 });
    expect(describePlan(withTarget, 'km')).toBe(
      'Aquecimento 10 min · 8 × 400 m (rec. 1 min) · alvo 3:50/km · Desaquecimento 5 min',
    );
    // 230 s/km × 1,609344 = 370,2 s/mi.
    expect(describePlan(withTarget, 'mi')).toBe(
      'Aquecimento 10 min · 8 × 400 m (rec. 1 min) · alvo 6:10/mi · Desaquecimento 5 min',
    );
  });

  it('omite as fases opcionais ausentes', () => {
    expect(
      describePlan(plan({ warmup: null, recovery: null, cooldown: null, reps: 6, work: { kind: 'time', seconds: 120 } }), 'km'),
    ).toBe('6 × 2 min');
  });
});
