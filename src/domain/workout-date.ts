export interface DayOption {
  /** AAAA-MM-DD no fuso local. */
  key: string;
  label: string;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Dia local (AAAA-MM-DD) de uma data. */
export const keyOfDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Dia local (AAAA-MM-DD) de uma data ISO. */
export function dayKeyOf(iso: string): string {
  return keyOfDate(new Date(iso));
}

/** Hoje, ontem e os dias anteriores, para escolher o dia de um treino. */
export function recentDays(now: Date = new Date(), count = 7): DayOption[] {
  return Array.from({ length: count }, (_, offset) => {
    // Pelo calendário (não -24h em ms), por causa do horário de verão.
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const label =
      offset === 0
        ? 'Hoje'
        : offset === 1
          ? 'Ontem'
          : `${WEEKDAYS[day.getDay()]} ${pad2(day.getDate())}/${pad2(day.getMonth() + 1)}`;
    return { key: keyOfDate(day), label };
  });
}

/** ISO do dia escolhido com a hora atual, para manter a ordem natural do diário. */
export function dateOnDay(dayKey: string, now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return now.toISOString();
  const [, y, m, d] = match;
  return new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ).toISOString();
}
