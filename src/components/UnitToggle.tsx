import { Pressable, Text, View } from 'react-native';

import type { DistanceUnit } from '../domain/pace';

const OPTIONS: { value: DistanceUnit; label: string; spoken: string }[] = [
  { value: 'km', label: 'km', spoken: 'quilômetros' },
  { value: 'mi', label: 'mi', spoken: 'milhas' },
];

interface Props {
  value: DistanceUnit;
  onChange: (unit: DistanceUnit) => void;
}

export function UnitToggle({ value, onChange }: Props) {
  return (
    <View className="flex-row rounded-full bg-surface-2 p-1 dark:bg-surface-2-dark" accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.spoken}
            className={`min-h-12 min-w-16 items-center justify-center rounded-full px-4 active:opacity-70 ${
              selected ? 'bg-brand dark:bg-brand-dark' : ''
            }`}
          >
            <Text
              className={`text-lg font-bold ${
                selected ? 'text-white' : 'text-ink dark:text-ink-dark'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
