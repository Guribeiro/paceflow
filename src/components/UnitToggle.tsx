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
    <View className="flex-row rounded-xl border-2 border-black dark:border-white" accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.spoken}
            className={`min-h-12 min-w-16 items-center justify-center px-4 ${
              selected ? 'bg-black dark:bg-white' : ''
            }`}
          >
            <Text
              className={`text-lg font-bold ${
                selected ? 'text-white dark:text-black' : 'text-black dark:text-white'
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
