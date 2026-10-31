import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { PersonalRecordsCard } from '../components/PersonalRecordsCard';
import { RaceGoalCard } from '../components/RaceGoalCard';
import { TrainingLoadCard } from '../components/TrainingLoadCard';
import { TrainingPlan } from '../components/TrainingPlan';
import { WeeklyBarChart, weekLabel } from '../components/WeeklyBarChart';
import { KM_PER_MILE, formatDistance, formatDuration } from '../domain/pace';
import { streakLabel } from '../domain/streak';
import { averagePace, comparePace, summarizeTrends, weeklyTotals } from '../domain/workout-trends';
import { useCurrentWeek } from '../hooks/useCurrentWeek';
import { useLargeText } from '../hooks/useLargeText';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useStreak } from '../hooks/useStreak';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useWorkouts } from '../hooks/useWorkouts';
import { Card } from '../components/ui/Card';
import { Disclosure } from '../components/ui/Disclosure';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { StatTile } from '../components/ui/StatTile';
import { display } from '../components/ui/typography';

const WEEKS = 12;

export function TrendsScreen() {
  const workouts = useWorkouts();
  const [unit] = usePreferredUnit();
  const [goalMeters] = useWeeklyGoal();
  const large = useLargeText();
  const currentWeek = useCurrentWeek();
  // currentWeek: recalcula na virada da semana.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => weeklyTotals(workouts, new Date(), WEEKS), [workouts, currentWeek]);
  const trends = useMemo(() => summarizeTrends(weeks), [weeks]);
  const streak = useStreak();
  const [selected, setSelected] = useState(WEEKS - 1);

  const paceIn = (secondsPerKm: number) => formatDuration(unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const week = weeks[selected];
  const weekPace = averagePace(week);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
          <ScreenHeader eyebrow={`Últimas ${WEEKS} semanas`} title="Evolução" />

          <RaceGoalCard unit={unit} />
          <PersonalRecordsCard unit={unit} />
          <TrainingPlan unit={unit} />

          {trends.activeWeeks === 0 ? (
            <Text className="text-lg text-muted dark:text-muted-dark">
              Registre treinos para ver sua evolução nas últimas {WEEKS} semanas.
            </Text>
          ) : (
            <>
              <Card gap={2} title={`Distância por semana (${unit})`} icon="chart">
                {/* Leitura da barra selecionada: o "tooltip" do toque. */}
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-base font-semibold text-ink dark:text-ink-dark"
                  style={display}
                >
                  {selected === WEEKS - 1 ? 'Esta semana' : `Semana de ${weekLabel(week.weekStart)}`}:{' '}
                  {formatDistance(week.distanceMeters, unit)} {unit} · {week.count}{' '}
                  {week.count === 1 ? 'treino' : 'treinos'}
                  {weekPace !== null ? ` · ${paceIn(weekPace)}/${unit}` : ''}
                </Text>
                <WeeklyBarChart weeks={weeks} unit={unit} selected={selected} onSelect={setSelected} goalMeters={goalMeters} />
              </Card>

              <View className={`${large ? 'flex-col' : 'flex-row flex-wrap'} gap-3`}>
                <StatTile
                  label="Média semanal"
                  value={`${formatDistance(trends.averageWeeklyMeters ?? 0, unit)} ${unit}`}
                  detail={`em ${trends.activeWeeks} ${trends.activeWeeks === 1 ? 'semana ativa' : 'semanas ativas'}`}
                />
                <StatTile
                  label="Sequência"
                  value={String(streak.current)}
                  suffix={streak.current === 1 ? 'semana' : 'semanas'}
                  detail={`melhor: ${streakLabel(streak.best)}`}
                />
                {trends.bestWeek ? (
                  <StatTile
                    label="Melhor semana"
                    value={`${formatDistance(trends.bestWeek.distanceMeters, unit)} ${unit}`}
                    detail={`semana de ${weekLabel(trends.bestWeek.weekStart)}`}
                  />
                ) : null}
                {trends.paceChange ? (
                  <StatTile
                    label="Pace (4 semanas)"
                    value={`${paceIn(trends.paceChange.recent)}/${unit}`}
                    detail={`${comparePace(
                      unit === 'mi' ? trends.paceChange.deltaSeconds * KM_PER_MILE : trends.paceChange.deltaSeconds,
                    )} que as 4 anteriores`}
                  />
                ) : null}
              </View>

              <Disclosure showLabel="Ver como tabela" hideLabel="Ocultar tabela">
                <View className="rounded-2xl border-2 border-surface-2 bg-surface dark:border-surface-2-dark dark:bg-surface-dark">
                  {[...weeks].reverse().map((w, i) => (
                    <View
                      key={w.weekStart}
                      accessible
                      accessibilityLabel={`Semana de ${weekLabel(w.weekStart)}: ${formatDistance(w.distanceMeters, unit)} ${unit}, ${w.count} ${w.count === 1 ? 'treino' : 'treinos'}`}
                      className={`flex-row flex-wrap justify-between gap-x-4 px-4 py-2 ${
                        i > 0 ? 'border-t border-surface-2 dark:border-surface-2-dark' : ''
                      }`}
                    >
                      <Text className="text-base text-ink dark:text-ink-dark">{weekLabel(w.weekStart)}</Text>
                      <Text className="text-base font-semibold text-ink dark:text-ink-dark" style={display}>
                        {formatDistance(w.distanceMeters, unit)} {unit} · {w.count} {w.count === 1 ? 'treino' : 'treinos'}
                      </Text>
                    </View>
                  ))}
                </View>
              </Disclosure>

              <TrainingLoadCard />
            </>
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
