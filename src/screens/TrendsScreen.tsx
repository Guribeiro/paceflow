import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { RaceGoalCard } from '../components/RaceGoalCard';
import { WeeklyBarChart, weekLabel } from '../components/WeeklyBarChart';
import { KM_PER_MILE, formatDistance, formatDuration } from '../domain/pace';
import { averagePace, comparePace, summarizeTrends, weeklyTotals } from '../domain/workout-trends';
import { BIG_NUMBER_MAX_SCALE, useLargeText } from '../hooks/useLargeText';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useWorkouts } from '../hooks/useWorkouts';

const WEEKS = 12;
const tabular = { fontVariant: ['tabular-nums' as const] };

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      className="min-w-36 flex-1 gap-1 rounded-xl border-2 border-black p-3 dark:border-white"
    >
      <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</Text>
      <Text
        className="text-2xl font-bold text-black dark:text-white"
        style={tabular}
        maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
      >
        {value}
      </Text>
      {detail ? <Text className="text-sm text-neutral-700 dark:text-neutral-300">{detail}</Text> : null}
    </View>
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
  const [showTable, setShowTable] = useState(false);

  const paceIn = (secondsPerKm: number) => formatDuration(unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const week = weeks[selected];
  const weekPace = averagePace(week);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
            Evolução
          </Text>

          <RaceGoalCard unit={unit} />

          {trends.activeWeeks === 0 ? (
            <Text className="text-lg text-neutral-700 dark:text-neutral-300">
              Registre treinos para ver sua evolução nas últimas {WEEKS} semanas.
            </Text>
          ) : (
            <>
              <View className="gap-2">
                <Text className="text-lg font-bold text-black dark:text-white">Distância por semana ({unit})</Text>
                {/* Leitura da barra selecionada: o "tooltip" do toque. */}
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-base font-semibold text-black dark:text-white"
                  style={tabular}
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

              <Pressable
                onPress={() => setShowTable((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showTable }}
                className="min-h-12 justify-center self-start"
              >
                <Text className="text-base font-semibold text-black underline dark:text-white">
                  {showTable ? 'Ocultar tabela' : 'Ver como tabela'}
                </Text>
              </Pressable>

              {showTable ? (
                <View className="rounded-xl border-2 border-black dark:border-white">
                  {[...weeks].reverse().map((w, i) => (
                    <View
                      key={w.weekStart}
                      accessible
                      className={`flex-row flex-wrap justify-between gap-x-4 px-4 py-2 ${
                        i > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
                      }`}
                    >
                      <Text className="text-base text-black dark:text-white">{weekLabel(w.weekStart)}</Text>
                      <Text className="text-base font-semibold text-black dark:text-white" style={tabular}>
                        {formatDistance(w.distanceMeters, unit)} {unit} · {w.count}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
