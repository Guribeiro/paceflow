import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { type DistanceUnit, KM_PER_MILE, type PaceRange, formatDistance, formatDuration } from '../domain/pace';
import { type PlanPhase, type TrainingPlanWeek, buildTrainingPlan, planProgress } from '../domain/training-plan';
import { useRaceGoal } from '../hooks/useRaceGoal';
import { useWorkouts } from '../hooks/useWorkouts';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { SectionHeader } from './ui/SectionHeader';
import { tabular } from './ui/typography';

const UPCOMING = 4;

const PHASE_LABEL: Record<PlanPhase, string> = {
  base: 'Base',
  build: 'Construção',
  peak: 'Pico',
  taper: 'Polimento',
  race: 'Semana da prova',
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const weekLabel = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

function CurrentWeek({ week, unit }: { week: TrainingPlanWeek; unit: DistanceUnit }) {
  const workouts = useWorkouts();
  const progress = planProgress(week, workouts);
  const ratio = Math.min(1, progress.doneMeters / week.targetMeters);
  const perUnit = (s: number) => formatDuration(unit === 'mi' ? s * KM_PER_MILE : s);
  const paceText = (pace?: PaceRange) =>
    pace ? (pace.fastest === pace.slowest ? `${perUnit(pace.fastest)}/${unit}` : `${perUnit(pace.fastest)}–${perUnit(pace.slowest)}/${unit}`) : null;
  const done = `${formatDistance(progress.doneMeters, unit)} de ${formatDistance(week.targetMeters, unit)} ${unit}`;

  return (
    <Card variant="inverted">
      <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">
        Esta semana · {PHASE_LABEL[week.phase]}
        {week.isCutback ? ' (alívio)' : ''}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Volume da semana: ${done}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        className="gap-2"
      >
        <Text className="text-2xl font-bold text-white dark:text-black" style={tabular}>
          {done}
        </Text>
        <ProgressBar ratio={ratio} inverted />
      </View>
      {week.sessions.map((session) => {
        const isDone = session.kind === 'long' && progress.longRunDone;
        const pace = paceText(session.pace);
        return (
          <View
            key={session.kind}
            accessible
            accessibilityLabel={`${session.title}${isDone ? ', feito' : ''}: ${session.detail}${pace ? `, pace ${pace}` : ''}`}
            className="gap-0.5"
          >
            <Text className="text-lg font-bold text-white dark:text-black">
              {isDone ? '✓ ' : ''}
              {session.title}
            </Text>
            <Text className="text-base text-neutral-200 dark:text-neutral-800" style={tabular}>
              {session.detail}
              {pace ? ` · ${pace}` : ''}
            </Text>
          </View>
        );
      })}
      <Text className="text-sm text-neutral-300 dark:text-neutral-700">Nos outros dias, corridas leves ou descanso.</Text>
    </Card>
  );
}

/** Plano semana a semana até a prova-alvo, abaixo do card "Rumo à prova". */
export function TrainingPlan({ unit }: { unit: DistanceUnit }) {
  const [goal] = useRaceGoal();
  const workouts = useWorkouts();
  const [showAll, setShowAll] = useState(false);
  const plan = useMemo(() => (goal ? buildTrainingPlan(goal, workouts) : null), [goal, workouts]);
  if (!plan || plan.weeks.length === 0) return null;

  const [current, ...next] = plan.weeks;
  const visible = showAll ? next : next.slice(0, UPCOMING);

  return (
    <View className="gap-3">
      <SectionHeader>Plano até a prova</SectionHeader>
      {plan.shortNotice ? (
        <Text className="text-base font-semibold text-black dark:text-white">
          Pouco tempo até a prova: o foco agora é chegar descansado.
        </Text>
      ) : null}

      <CurrentWeek week={current} unit={unit} />

      {next.length > 0 ? (
        <View className="rounded-xl border-2 border-black dark:border-white">
          {visible.map((week, i) => (
            <View
              key={week.weekStart}
              accessible
              accessibilityLabel={`Semana de ${weekLabel(week.weekStart)}: ${PHASE_LABEL[week.phase]}, ${formatDistance(week.targetMeters, unit)} ${unit}${
                week.isRaceWeek ? ', com a prova' : `, longão de ${formatDistance(week.longRunMeters, unit)} ${unit}`
              }`}
              className={`flex-row flex-wrap items-center justify-between gap-x-4 px-4 py-2 ${
                i > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
              }`}
            >
              <Text className="text-base text-black dark:text-white">
                {weekLabel(week.weekStart)} · {PHASE_LABEL[week.phase]}
              </Text>
              <Text className="text-base font-semibold text-black dark:text-white" style={tabular}>
                {formatDistance(week.targetMeters, unit)} {unit}
                {week.isRaceWeek ? ' · prova' : ` · longão ${formatDistance(week.longRunMeters, unit)}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {next.length > UPCOMING ? (
        <Button
          label={showAll ? 'Mostrar menos' : `Ver todas as ${next.length} semanas`}
          variant="link"
          expanded={showAll}
          onPress={() => setShowAll((v) => !v)}
        />
      ) : null}

      <Text className="text-sm text-neutral-700 dark:text-neutral-300">
        Plano genérico de referência. Ajuste ao seu corpo; procure um profissional se sentir dor.
      </Text>
    </View>
  );
}
