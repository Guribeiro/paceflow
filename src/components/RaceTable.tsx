import { Text, View } from 'react-native';

import { type RacePrediction, formatDuration, spokenDuration } from '../domain/pace';
import { tabular } from './ui/typography';

interface Props {
  races: RacePrediction[];
}

export function RaceTable({ races }: Props) {
  return (
    <View className="rounded-xl border-2 border-black dark:border-white">
      {races.map((race, index) => (
        <View
          key={race.id}
          accessible
          accessibilityLabel={`${race.label}: ${spokenDuration(race.durationSeconds)}, pace de ${spokenDuration(
            race.secondsPerKm,
          )} por quilômetro`}
          className={`flex-row flex-wrap items-center justify-between gap-x-4 px-4 py-3 ${
            index > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
          }`}
        >
          <Text className="text-lg font-semibold text-black dark:text-white">{race.label}</Text>
          <View className="items-end">
            <Text className="text-2xl font-bold text-black dark:text-white" style={tabular}>
              {formatDuration(race.durationSeconds)}
            </Text>
            <Text className="text-base text-neutral-700 dark:text-neutral-300" style={tabular}>
              {formatDuration(race.secondsPerKm)}/km
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
