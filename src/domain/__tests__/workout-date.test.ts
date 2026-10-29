import { dateOnDay, dayKeyOf, recentDays } from '../workout-date';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('recentDays', () => {
  it('lista hoje, ontem e os dias anteriores com dia da semana', () => {
    // 29/10/2026 é quinta-feira
    expect(recentDays(local(2026, 10, 29, 20), 7)).toEqual([
      { key: '2026-10-29', label: 'Hoje' },
      { key: '2026-10-28', label: 'Ontem' },
      { key: '2026-10-27', label: 'ter 27/10' },
      { key: '2026-10-26', label: 'seg 26/10' },
      { key: '2026-10-25', label: 'dom 25/10' },
      { key: '2026-10-24', label: 'sáb 24/10' },
      { key: '2026-10-23', label: 'sex 23/10' },
    ]);
  });

  it('atravessa a virada de mês e de ano', () => {
    expect(recentDays(local(2027, 1, 1, 8), 3).map((d) => d.key)).toEqual(['2027-01-01', '2026-12-31', '2026-12-30']);
  });
});

describe('dateOnDay', () => {
  it('mantém a hora atual no dia escolhido', () => {
    const now = local(2026, 10, 29, 20, 15);
    expect(dateOnDay('2026-10-28', now)).toBe(local(2026, 10, 28, 20, 15).toISOString());
  });

  it('hoje devolve o próprio instante', () => {
    const now = local(2026, 10, 29, 6, 30);
    expect(dateOnDay('2026-10-29', now)).toBe(now.toISOString());
  });

  it('chave inválida cai em agora', () => {
    const now = local(2026, 10, 29, 6, 30);
    expect(dateOnDay('ontem', now)).toBe(now.toISOString());
  });
});

describe('dayKeyOf', () => {
  it('usa o dia local da data ISO', () => {
    expect(dayKeyOf(local(2026, 10, 28, 23, 59).toISOString())).toBe('2026-10-28');
    expect(dayKeyOf(local(2026, 1, 5, 0, 1).toISOString())).toBe('2026-01-05');
  });
});
