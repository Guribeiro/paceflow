import { Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance, formatDuration, spokenDuration } from '../domain/pace';
import type { WeekSummary } from '../domain/workout-summary';

const tabular = { fontVariant: ['tabular-nums' as const] };

interface Props {
  summary: WeekSummary;
  unit: DistanceUnit;
}

export function WeekSummaryCard({ summary, unit }: Props) {
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
      <Text className="text-5xl font-bold text-white dark:text-black" style={tabular}>
        {distance}
        <Text className="text-2xl"> {unit}</Text>
      </Text>
      <Text className="text-lg font-semibold text-neutral-200 dark:text-neutral-800" style={tabular}>
        {summary.count} {treinos} · {formatDuration(summary.durationSeconds)}
      </Text>
    </View>
  );
}
