import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { PersonalRecordsCard } from '../components/PersonalRecordsCard';
import { RaceGoalCard } from '../components/RaceGoalCard';
import { TrainingPlan } from '../components/TrainingPlan';
import { WeeklyBarChart, weekLabel } from '../components/WeeklyBarChart';
import { KM_PER_MILE, formatDistance, formatDuration } from '../domain/pace';
import { averagePace, comparePace, summarizeTrends, weeklyTotals } from '../domain/workout-trends';
import { BIG_NUMBER_MAX_SCALE, useLargeText } from '../hooks/useLargeText';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useWorkouts } from '../hooks/useWorkouts';
import { Card } from '../components/ui/Card';
import { Disclosure } from '../components/ui/Disclosure';
import { SectionHeader } from '../components/ui/SectionHeader';
import { display } from '../components/ui/typography';

const WEEKS = 12;

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      gap={1}
      compact
      className="min-w-36 flex-1"
    >
      <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</Text>
      <Text
        className="text-2xl font-bold text-black dark:text-white"
        style={display}
        maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
      >
        {value}
      </Text>
      {detail ? <Text className="text-sm text-neutral-700 dark:text-neutral-300">{detail}</Text> : null}
    </Card>
  );
}

export function TrendsScreen() {
  const workouts = useWorkouts();
  const [unit] = usePreferredUnit();
  const [goalMeters] = useWeeklyGoal();
  const large = useLargeText();
  const weeks = useMemo(() => weeklyTotals(workouts, new Date(), WEEKS), [workouts]);
  const trends = useMemo(() => summarizeTrends(weeks), [weeks]);
  const [selected, setSelected] = useState(WEEKS - 1);

  const paceIn = (secondsPerKm: number) => formatDuration(unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const week = weeks[selected];
  const weekPace = averagePace(week);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
            Evolução
          </Text>

          <RaceGoalCard unit={unit} />
          <PersonalRecordsCard unit={unit} />
          <TrainingPlan unit={unit} />

          {trends.activeWeeks === 0 ? (
            <Text className="text-lg text-neutral-700 dark:text-neutral-300">
              Registre treinos para ver sua evolução nas últimas {WEEKS} semanas.
            </Text>
          ) : (
            <>
              <View className="gap-2">
                <SectionHeader>{`Distância por semana (${unit})`}</SectionHeader>
                {/* Leitura da barra selecionada: o "tooltip" do toque. */}
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-base font-semibold text-black dark:text-white"
                  style={display}
                >
                  {selected === WEEKS - 1 ? 'Esta semana' : `Semana de ${weekLabel(week.weekStart)}`}:{' '}
                  {formatDistance(week.distanceMeters, unit)} {unit} · {week.count}{' '}
                  {week.count === 1 ? 'treino' : 'treinos'}
                  {weekPace !== null ? ` · ${paceIn(weekPace)}/${unit}` : ''}
                </Text>
                <WeeklyBarChart weeks={weeks} unit={unit} selected={selected} onSelect={setSelected} goalMeters={goalMeters} />
              </View>

              <View className={`${large ? 'flex-col' : 'flex-row flex-wrap'} gap-3`}>
                <StatTile
                  label="Média semanal"
                  value={`${formatDistance(trends.averageWeeklyMeters ?? 0, unit)} ${unit}`}
                  detail={`em ${trends.activeWeeks} ${trends.activeWeeks === 1 ? 'semana ativa' : 'semanas ativas'}`}
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
                <View className="rounded-xl border-2 border-black dark:border-white">
                  {[...weeks].reverse().map((w, i) => (
                    <View
                      key={w.weekStart}
                      accessible
                      accessibilityLabel={`Semana de ${weekLabel(w.weekStart)}: ${formatDistance(w.distanceMeters, unit)} ${unit}, ${w.count} ${w.count === 1 ? 'treino' : 'treinos'}`}
                      className={`flex-row flex-wrap justify-between gap-x-4 px-4 py-2 ${
                        i > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
                      }`}
                    >
                      <Text className="text-base text-black dark:text-white">{weekLabel(w.weekStart)}</Text>
                      <Text className="text-base font-semibold text-black dark:text-white" style={display}>
                        {formatDistance(w.distanceMeters, unit)} {unit} · {w.count} {w.count === 1 ? 'treino' : 'treinos'}
                      </Text>
                    </View>
                  ))}
                </View>
              </Disclosure>
            </>
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
