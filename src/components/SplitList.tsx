import { Text, View } from 'react-native';

import { type DistanceUnit, formatDuration, spokenDuration } from '../domain/pace';
import { display } from './ui/typography';

interface Props {
  /** Duração de cada parcial, em segundos. */
  splits: readonly number[];
  unit: DistanceUnit;
}

/** Uma linha por parcial, com a mais rápida em destaque. */
export function SplitList({ splits, unit }: Props) {
  if (splits.length === 0) return null;
  // Só destaca quando uma parcial é a única mais rápida no segundo exibido (empate não tem destaque).
  const shown = splits.map(Math.round);
  const min = Math.min(...shown);
  const fastest = shown.length > 1 && shown.filter((s) => s === min).length === 1 ? shown.indexOf(min) : -1;
  return (
    <View>
      {splits.map((seconds, i) => {
        // A mais rápida marcada por texto, não só pela cor.
        const best = i === fastest;
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`${unit === 'km' ? 'Quilômetro' : 'Milha'} ${i + 1}: ${spokenDuration(seconds)}${best ? ', a mais rápida' : ''}`}
            className={`min-h-12 flex-row items-center justify-between ${i > 0 ? 'border-t border-surface-2 dark:border-surface-2-dark' : ''}`}
          >
            <Text className="text-lg text-ink dark:text-ink-dark">
              {i + 1} {unit}
              {best ? ' · mais rápida' : ''}
            </Text>
            <Text
              className={`text-xl font-bold ${best ? 'text-brand-ink dark:text-brand-ink-dark' : 'text-ink dark:text-ink-dark'}`}
              style={display}
            >
              {formatDuration(seconds)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
