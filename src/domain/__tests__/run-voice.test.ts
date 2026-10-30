import {
  DEFAULT_VOICE_PREFERENCES,
  type VoicePreferences,
  autoPauseAnnouncement,
  parseVoicePreferences,
  splitAnnouncement,
} from '../run-voice';

const MILE = 1609.344;

const prefs = (change: Partial<VoicePreferences> = {}): VoicePreferences => ({
  ...DEFAULT_VOICE_PREFERENCES,
  ...change,
});

const ALL_ON = prefs({ splitTime: true, averagePace: true, totalTime: true });

describe('DEFAULT_VOICE_PREFERENCES', () => {
  it('fala o tempo da parcial e o pace médio, sem o tempo total', () => {
    expect(DEFAULT_VOICE_PREFERENCES).toEqual({ enabled: true, splitTime: true, averagePace: true, totalTime: false });
  });
});

describe('splitAnnouncement', () => {
  it('na primeira parcial, o tempo da parcial é o tempo desde a largada', () => {
    expect(splitAnnouncement({ splits: [308_000], splitMeters: 1000 }, ALL_ON)).toBe(
      'Quilômetro 1. Parcial: 5 minutos e 8 segundos. Pace médio: 5 minutos e 8 segundos por quilômetro. ' +
        'Tempo total: 5 minutos e 8 segundos.',
    );
  });

  it('na parcial N, fala o tempo só dela e o pace médio de todas', () => {
    // Parciais de 300 s, 312 s e 318 s: média 310 s = 5:10.
    expect(splitAnnouncement({ splits: [300_000, 612_000, 930_000], splitMeters: 1000 }, ALL_ON)).toBe(
      'Quilômetro 3. Parcial: 5 minutos e 18 segundos. Pace médio: 5 minutos e 10 segundos por quilômetro. ' +
        'Tempo total: 15 minutos e 30 segundos.',
    );
  });

  it('em milhas, fala "Milha" e "por milha"', () => {
    // Parciais de 480 s e 490 s: média 485 s = 8:05.
    expect(splitAnnouncement({ splits: [480_000, 970_000], splitMeters: MILE }, ALL_ON)).toBe(
      'Milha 2. Parcial: 8 minutos e 10 segundos. Pace médio: 8 minutos e 5 segundos por milha. ' +
        'Tempo total: 16 minutos e 10 segundos.',
    );
  });

  it('com as preferências padrão, não fala o tempo total', () => {
    expect(splitAnnouncement({ splits: [300_000, 612_000], splitMeters: 1000 }, DEFAULT_VOICE_PREFERENCES)).toBe(
      'Quilômetro 2. Parcial: 5 minutos e 12 segundos. Pace médio: 5 minutos e 6 segundos por quilômetro.',
    );
  });

  it('fala horas no tempo total de corridas longas', () => {
    const splits = Array.from({ length: 12 }, (_, i) => (i + 1) * 310_000); // 12 × 5:10 = 1h 2min
    expect(splitAnnouncement({ splits, splitMeters: 1000 }, prefs({ splitTime: false, averagePace: false, totalTime: true }))).toBe(
      'Quilômetro 12. Tempo total: 1 hora e 2 minutos.',
    );
  });

  it.each<[string, Partial<VoicePreferences>, string]>([
    ['nada além do número', { splitTime: false, averagePace: false, totalTime: false }, 'Quilômetro 2.'],
    ['só a parcial', { splitTime: true, averagePace: false, totalTime: false }, 'Quilômetro 2. Parcial: 5 minutos e 12 segundos.'],
    [
      'só o pace médio',
      { splitTime: false, averagePace: true, totalTime: false },
      'Quilômetro 2. Pace médio: 5 minutos e 6 segundos por quilômetro.',
    ],
    ['só o tempo total', { splitTime: false, averagePace: false, totalTime: true }, 'Quilômetro 2. Tempo total: 10 minutos e 12 segundos.'],
    [
      'parcial e pace médio',
      { splitTime: true, averagePace: true, totalTime: false },
      'Quilômetro 2. Parcial: 5 minutos e 12 segundos. Pace médio: 5 minutos e 6 segundos por quilômetro.',
    ],
    [
      'parcial e tempo total',
      { splitTime: true, averagePace: false, totalTime: true },
      'Quilômetro 2. Parcial: 5 minutos e 12 segundos. Tempo total: 10 minutos e 12 segundos.',
    ],
    [
      'pace médio e tempo total',
      { splitTime: false, averagePace: true, totalTime: true },
      'Quilômetro 2. Pace médio: 5 minutos e 6 segundos por quilômetro. Tempo total: 10 minutos e 12 segundos.',
    ],
    [
      'tudo',
      { splitTime: true, averagePace: true, totalTime: true },
      'Quilômetro 2. Parcial: 5 minutos e 12 segundos. Pace médio: 5 minutos e 6 segundos por quilômetro. ' +
        'Tempo total: 10 minutos e 12 segundos.',
    ],
  ])('com %s ligado, fala exatamente esses itens', (_, change, expected) => {
    expect(splitAnnouncement({ splits: [300_000, 612_000], splitMeters: 1000 }, prefs(change))).toBe(expected);
  });

  it('com a voz desligada, não fala nada', () => {
    expect(splitAnnouncement({ splits: [300_000], splitMeters: 1000 }, prefs({ enabled: false }))).toBeNull();
    expect(splitAnnouncement({ splits: [300_000], splitMeters: 1000 }, { ...ALL_ON, enabled: false })).toBeNull();
  });

  it('sem parcial fechada, não fala nada', () => {
    expect(splitAnnouncement({ splits: [], splitMeters: 1000 }, ALL_ON)).toBeNull();
    expect(splitAnnouncement({ splits: [], splitMeters: MILE }, ALL_ON)).toBeNull();
  });
});

describe('parseVoicePreferences', () => {
  it('aceita um objeto com os quatro campos booleanos e descarta campos extras', () => {
    expect(
      parseVoicePreferences({ enabled: false, splitTime: true, averagePace: false, totalTime: true, extra: 1 }),
    ).toEqual({ enabled: false, splitTime: true, averagePace: false, totalTime: true });
  });

  it.each(['enabled', 'splitTime', 'averagePace', 'totalTime'] as const)('rejeita sem o campo %s', (key) => {
    const value: Record<string, unknown> = { ...ALL_ON };
    delete value[key];
    expect(parseVoicePreferences(value)).toBeNull();
  });

  it.each(['enabled', 'splitTime', 'averagePace', 'totalTime'] as const)('rejeita %s que não é booleano', (key) => {
    expect(parseVoicePreferences({ ...ALL_ON, [key]: 'true' })).toBeNull();
    expect(parseVoicePreferences({ ...ALL_ON, [key]: 1 })).toBeNull();
    expect(parseVoicePreferences({ ...ALL_ON, [key]: null })).toBeNull();
  });

  it.each([null, undefined, 'texto', 42, true])('rejeita o valor %p, que não é objeto', (value) => {
    expect(parseVoicePreferences(value)).toBeNull();
  });

  it('rejeita um array', () => {
    expect(parseVoicePreferences([true, true, true, false])).toBeNull();
  });
});

describe('autoPauseAnnouncement', () => {
  const moving = { autoPaused: false, status: 'running' as const };
  const stopped = { autoPaused: true, status: 'running' as const };

  it('fala ao entrar e ao sair da pausa automática', () => {
    expect(autoPauseAnnouncement(moving, stopped, DEFAULT_VOICE_PREFERENCES)).toBe('Pausa automática.');
    expect(autoPauseAnnouncement(stopped, moving, DEFAULT_VOICE_PREFERENCES)).toBe('Retomando.');
  });

  it('não repete sem mudança', () => {
    expect(autoPauseAnnouncement(moving, moving, DEFAULT_VOICE_PREFERENCES)).toBeNull();
    expect(autoPauseAnnouncement(stopped, stopped, DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });

  it('não fala com a voz desligada, mesmo com as outras opções ligadas', () => {
    expect(autoPauseAnnouncement(moving, stopped, prefs({ enabled: false }))).toBeNull();
    expect(autoPauseAnnouncement(stopped, moving, prefs({ enabled: false }))).toBeNull();
  });

  it('fala mesmo com tempo, pace e total desligados', () => {
    const quiet = prefs({ splitTime: false, averagePace: false, totalTime: false });
    expect(autoPauseAnnouncement(moving, stopped, quiet)).toBe('Pausa automática.');
  });

  it.each(['paused', 'finished'] as const)('não fala "Retomando." quando a corrida fica %s', (status) => {
    expect(autoPauseAnnouncement(stopped, { autoPaused: false, status }, DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });
});
