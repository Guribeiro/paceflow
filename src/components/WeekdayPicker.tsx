import { Pressable, Text, View } from 'react-native';

// Segunda primeiro, como o resto do app; valores no padrão de Date.getDay().
const DAYS = [
  { value: 1, label: 'Seg', spoken: 'Segunda' },
  { value: 2, label: 'Ter', spoken: 'Terça' },
  { value: 3, label: 'Qua', spoken: 'Quarta' },
  { value: 4, label: 'Qui', spoken: 'Quinta' },
  { value: 5, label: 'Sex', spoken: 'Sexta' },
  { value: 6, label: 'Sáb', spoken: 'Sábado' },
  { value: 0, label: 'Dom', spoken: 'Domingo' },
];

interface Props {
  label: string;
  value: readonly number[];
  onChange: (days: number[]) => void;
}

/** Dias da semana em chips de múltipla escolha (visual do ChoiceChips). */
export function WeekdayPicker({ label, value, onChange }: Props) {
  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-ink dark:text-ink-dark">{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityLabel={label}>
        {DAYS.map((day) => {
          const selected = value.includes(day.value);
          return (
            <Pressable
              key={day.value}
              onPress={() => onChange(selected ? value.filter((d) => d !== day.value) : [...value, day.value])}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={day.spoken}
              className={`min-h-12 min-w-12 items-center justify-center rounded-full px-3 active:opacity-70 ${
                selected ? 'bg-brand dark:bg-brand-dark' : 'bg-surface-2 dark:bg-surface-2-dark'
              }`}
            >
              <Text className={`text-lg font-bold ${selected ? 'text-white' : 'text-ink dark:text-ink-dark'}`}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
