import { Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance, formatDuration, spokenDuration } from '../domain/pace';
import { goalProgress } from '../domain/weekly-goal';
import type { WeekSummary } from '../domain/workout-summary';
import { BIG_NUMBER_MAX_SCALE } from '../hooks/useLargeText';

const tabular = { fontVariant: ['tabular-nums' as const] };

interface Props {
  summary: WeekSummary;
  unit: DistanceUnit;
  goalMeters?: number | null;
}

export function WeekSummaryCard({ summary, unit, goalMeters }: Props) {
  const distance = formatDistance(summary.distanceMeters, unit);
  const spokenUnit = unit === 'km' ? 'quilômetros' : 'milhas';
  const treinos = summary.count === 1 ? 'treino' : 'treinos';

  return (
    <View
      className="rounded-xl bg-black p-4 dark:bg-white"
      accessible
      accessibilityLabel={`Esta semana: ${distanceInUnit(summary.distanceMeters, unit)
        .toFixed(1)
        .replace('.', ',')} ${spokenUnit}, ${summary.count} ${treinos}, ${spokenDuration(summary.durationSeconds)}`}
    >
      <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">Esta semana</Text>
      <Text
        className="text-5xl font-bold text-white dark:text-black"
        style={tabular}
        maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
      >
        {distance}
        <Text className="text-2xl"> {unit}</Text>
      </Text>
      <Text className="text-lg font-semibold text-neutral-200 dark:text-neutral-800" style={tabular}>
        {summary.count} {treinos} · {formatDuration(summary.durationSeconds)}
      </Text>
      {goalMeters ? <GoalProgress distanceMeters={summary.distanceMeters} goalMeters={goalMeters} unit={unit} /> : null}
    </View>
  );
}

function GoalProgress({ distanceMeters, goalMeters, unit }: { distanceMeters: number; goalMeters: number; unit: DistanceUnit }) {
  const progress = goalProgress(distanceMeters, goalMeters);
  const target = `${formatDistance(goalMeters, unit)} ${unit}`;
  const text = progress.reached
    ? `Meta de ${target} batida! (${progress.percent}%)`
    : `${formatDistance(distanceMeters, unit)} de ${target} · faltam ${formatDistance(progress.remainingMeters, unit)} ${unit}`;

  return (
    <View
      className="mt-3 gap-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Meta semanal: ${text}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(100, progress.percent) }}
    >
      {/* Trilho em cinza e preenchimento invertido em relação ao card. */}
      <View className="h-3 overflow-hidden rounded-full bg-neutral-600 dark:bg-neutral-300">
        <View style={{ width: `${progress.ratio * 100}%` }} className="h-full rounded-full bg-white dark:bg-black" />
      </View>
      <Text className="text-base font-semibold text-neutral-200 dark:text-neutral-800" style={tabular}>
        {text}
      </Text>
    </View>
  );
}
