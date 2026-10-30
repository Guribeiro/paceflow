import { Pressable, Text, View } from 'react-native';

interface Option<T> {
  value: T;
  label: string;
  spoken?: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  value: T | undefined;
  /** Tocar de novo na opção selecionada envia `undefined` (desmarca). */
  onChange: (value: T | undefined) => void;
}

export function ChoiceChips<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-muted dark:text-muted-dark">{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(selected ? undefined : option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.spoken ?? option.label}
              className={`min-h-12 min-w-12 items-center justify-center rounded-full px-5 active:opacity-70 ${
                selected ? 'bg-brand dark:bg-brand-dark' : 'bg-surface-2 dark:bg-surface-2-dark'
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
    </View>
  );
}
