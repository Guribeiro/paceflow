import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { type LoadZone, formatRatio, weeklyLoads } from '../domain/training-load';
import { BIG_NUMBER_MAX_SCALE } from '../hooks/useLargeText';
import { useCurrentDay } from '../hooks/useCurrentDay';
import { useTrainingLoad } from '../hooks/useTrainingLoad';
import { useWorkouts } from '../hooks/useWorkouts';
import { WeekBars, weekLabel } from './WeeklyBarChart';
import { Card } from './ui/Card';
import { display } from './ui/typography';

const WEEKS = 12;

const loadNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const formatLoad = (load: number) => loadNumber.format(Math.round(load));

export const ZONE_TEXT: Record<Exclude<LoadZone, 'insuficiente'>, { title: string; advice: string }> = {
  baixa: {
    title: 'Abaixo do habitual',
    advice: 'Semana mais leve que a sua média: boa para recuperar, mas se durar o condicionamento cai.',
  },
  ideal: { title: 'Na medida', advice: 'Carga parecida com a sua média: bom ritmo para evoluir sem se machucar.' },
  atencao: { title: 'Subindo rápido', advice: 'Carga acima da sua média. Vá com calma nos próximos dias.' },
  alta: { title: 'Risco de lesão', advice: 'Aumento brusco de carga. Priorize descanso e treinos leves.' },
};

/** Carga (RPE × minutos) dos últimos 7 dias vs a média das 4 semanas, na Evolução. */
export function TrainingLoadCard() {
  const workouts = useWorkouts();
  const status = useTrainingLoad();
  const today = useCurrentDay();
  // today: a semana atual do gráfico anda com o calendário.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => weeklyLoads(workouts, new Date(), WEEKS), [workouts, today]);
  const [selected, setSelected] = useState(WEEKS - 1);
  const week = weeks[selected];

  if (status.zone === 'insuficiente' || status.ratio === null) {
    return (
      <Card title="Carga de treino" icon="bolt">
        <Text className="text-base text-muted dark:text-muted-dark">
          Registre treinos por 3 semanas para comparar sua carga recente com a sua média.
        </Text>
      </Card>
    );
  }

  const zone = ZONE_TEXT[status.zone];
  const ratio = formatRatio(status.ratio);

  return (
    <Card title="Carga de treino" icon="bolt" gap={2}>
      <View
        accessible
        accessibilityLabel={`Carga de treino: ${zone.title}. Últimos 7 dias: ${formatLoad(status.acute)}, média semanal: ${formatLoad(
          status.chronic,
        )}, ${ratio.replace('×', ' vezes')}. ${zone.advice}`}
        className="gap-1"
      >
        <Text
          className="text-3xl font-bold text-ink dark:text-ink-dark"
          style={display}
          maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
        >
          {zone.title}
        </Text>
        <Text className="text-base font-semibold text-ink dark:text-ink-dark" style={display}>
          Últimos 7 dias: {formatLoad(status.acute)} · média semanal: {formatLoad(status.chronic)} ({ratio})
        </Text>
        <Text className="text-base text-ink dark:text-ink-dark">{zone.advice}</Text>
      </View>

      <Text
        accessibilityLiveRegion="polite"
        className="text-base font-semibold text-ink dark:text-ink-dark"
        style={display}
      >
        {selected === WEEKS - 1 ? 'Esta semana' : `Semana de ${weekLabel(week.weekStart)}`}: {formatLoad(week.load)}
      </Text>
      <WeekBars
        weeks={weeks}
        value={(w) => w.load}
        spokenValue={(w) => `carga ${formatLoad(w.load)}, ${w.count} ${w.count === 1 ? 'treino' : 'treinos'}`}
        selected={selected}
        onSelect={setSelected}
        reference={{
          value: status.chronic,
          label: `Média ${formatLoad(status.chronic)}`,
          spoken: `Média semanal das últimas 4 semanas: ${formatLoad(status.chronic)}`,
        }}
      />

      <Text className="text-sm text-muted dark:text-muted-dark">
        Carga = esforço (RPE) × minutos.
        {status.estimated > 0
          ? ` ${status.estimated} ${status.estimated === 1 ? 'treino sem RPE usou' : 'treinos sem RPE usaram'} sua média (${String(
              status.fallbackRpe,
            ).replace('.', ',')}).`
          : ''}{' '}
        É uma estimativa, não orientação médica.
      </Text>
    </Card>
  );
}
