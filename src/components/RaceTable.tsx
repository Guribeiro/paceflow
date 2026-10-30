import { Text, View } from 'react-native';

import { type RacePrediction, formatDuration, spokenDuration } from '../domain/pace';
import { display, tabular } from './ui/typography';

interface Props {
  races: RacePrediction[];
}

export function RaceTable({ races }: Props) {
  return (
    <View className="rounded-2xl border-2 border-surface-2 bg-surface dark:border-surface-2-dark dark:bg-surface-dark">
      {races.map((race, index) => (
        <View
          key={race.id}
          accessible
          accessibilityLabel={`${race.label}: ${spokenDuration(race.durationSeconds)}, pace de ${spokenDuration(
            race.secondsPerKm,
          )} por quilômetro`}
          className={`flex-row flex-wrap items-center justify-between gap-x-4 px-4 py-3 ${
            index > 0 ? 'border-t border-surface-2 dark:border-surface-2-dark' : ''
          }`}
        >
          <Text className="text-lg font-semibold text-ink dark:text-ink-dark">{race.label}</Text>
          <View className="items-end">
            <Text className="text-2xl font-bold text-ink dark:text-ink-dark" style={display}>
              {formatDuration(race.durationSeconds)}
            </Text>
            <Text className="text-base text-muted dark:text-muted-dark" style={tabular}>
              {formatDuration(race.secondsPerKm)}/km
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
