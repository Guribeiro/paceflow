import { useState } from 'react';
import { Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance, parseDistance, toKilometers } from '../domain/pace';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { Field } from './Field';
import { Button } from './ui/Button';
import { confirmDestructive } from './ui/confirm';
import { Card } from './ui/Card';

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
    <Card gap={2} title="Meta semanal" icon="target">
      <Text className="text-base text-muted dark:text-muted-dark">
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
        <Button label="Salvar" accessibilityLabel="Salvar meta" size="lg" onPress={save} disabled={!valid} />
      </View>
      {goalMeters ? (
        <Button
          label="Remover meta"
          variant="danger-link"
          onPress={() =>
            confirmDestructive({
              title: 'Remover a meta semanal?',
              message: 'O resumo da semana deixa de mostrar o progresso; os treinos não mudam.',
              confirmLabel: 'Remover',
              onConfirm: () => setGoalMeters(null),
            })
          }
        />
      ) : null}
    </Card>
  );
}
