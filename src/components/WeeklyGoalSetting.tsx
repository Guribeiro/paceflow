import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance, parseDistance, toKilometers } from '../domain/pace';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { Field } from './Field';

/** Meta semanal digitada na unidade preferida e guardada em metros. */
export function WeeklyGoalSetting({ unit }: { unit: DistanceUnit }) {
  const [goalMeters, setGoalMeters] = useWeeklyGoal();
  const [text, setText] = useState('');
  const parsed = parseDistance(text);
  const valid = parsed.ok && parsed.value > 0;

  function save() {
    if (!parsed.ok || parsed.value <= 0) return;
    setGoalMeters(toKilometers(parsed.value, unit) * 1000);
    setText('');
  }

  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Meta semanal</Text>
      <Text className="text-base text-neutral-700 dark:text-neutral-300">
        {goalMeters
          ? `Atual: ${formatDistance(goalMeters, unit)} ${unit} por semana.`
          : 'Sem meta. Defina quantos quilômetros quer correr por semana.'}
      </Text>
      <View className="flex-row flex-wrap items-end gap-3">
        <View className="min-w-36 flex-1">
          <Field
            label={`Nova meta (${unit})`}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder={goalMeters ? distanceInUnit(goalMeters, unit).toFixed(0) : '20'}
            error={text && !valid ? 'Use um número, ex.: 20 ou 32,5' : undefined}
            fill={false}
          />
        </View>
        <Pressable
          onPress={save}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityLabel="Salvar meta"
          accessibilityState={{ disabled: !valid }}
          className={`min-h-14 justify-center rounded-xl px-5 ${valid ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
        >
          <Text className={`text-lg font-bold ${valid ? 'text-white dark:text-black' : 'text-neutral-700 dark:text-neutral-300'}`}>
            Salvar
          </Text>
        </Pressable>
      </View>
      {goalMeters ? (
        <Pressable
          onPress={() => setGoalMeters(null)}
          accessibilityRole="button"
          className="min-h-12 justify-center self-start"
        >
          <Text className="text-base font-semibold text-black underline dark:text-white">Remover meta</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
