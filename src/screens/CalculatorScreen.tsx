import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '../components/Field';
import { RaceTable } from '../components/RaceTable';
import { SaveWorkoutForm } from '../components/SaveWorkoutForm';
import { UnitToggle } from '../components/UnitToggle';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import {
  calculatePace,
  formatDuration,
  parseDistance,
  parseDuration,
  predictRaceTimes,
  spokenDuration,
} from '../domain/pace';

const tabular = { fontVariant: ['tabular-nums' as const] };

export function CalculatorScreen() {
  const [unit, setUnit] = usePreferredUnit();
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');

  const distance = useMemo(() => parseDistance(distanceText), [distanceText]);
  const duration = useMemo(() => parseDuration(durationText), [durationText]);

  const pace = useMemo(() => {
    if (!distance.ok || !duration.ok) return null;
    const result = calculatePace({ distance: distance.value, unit, durationSeconds: duration.value });
    return result.ok ? result.value : null;
  }, [distance, duration, unit]);

  const races = useMemo(() => {
    if (!pace || !duration.ok) return null;
    const result = predictRaceTimes({ distanceKm: pace.distanceKm, durationSeconds: duration.value });
    return result.ok ? result.value : null;
  }, [pace, duration]);

  // Só mostra erro depois que o usuário digitou algo.
  const distanceError = distanceText && !distance.ok ? 'Use um número, ex.: 5 ou 21,1' : undefined;
  const durationError = durationText && !duration.ok ? 'Use mm:ss ou h:mm:ss' : undefined;

  const mainPace = unit === 'km' ? pace?.secondsPerKm : pace?.secondsPerMile;
  const mainSpeed = unit === 'km' ? pace?.kmh : pace?.mph;
  const speedUnit = unit === 'km' ? 'km/h' : 'mph';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
            Calculadora
          </Text>
          <UnitToggle value={unit} onChange={setUnit} />
        </View>

        <View className="flex-row gap-3">
          <Field
            label={`Distância (${unit})`}
            value={distanceText}
            onChangeText={setDistanceText}
            placeholder="5"
            keyboardType="decimal-pad"
            error={distanceError}
          />
          <Field
            label="Tempo"
            value={durationText}
            onChangeText={setDurationText}
            placeholder="25:00"
            keyboardType="numbers-and-punctuation"
            error={durationError}
          />
        </View>

        <View className="flex-row gap-3">
          <View
            className="flex-1 rounded-xl bg-black p-4 dark:bg-white"
            accessible
            accessibilityLabel={
              mainPace !== undefined
                ? `Pace: ${spokenDuration(mainPace)} por ${unit === 'km' ? 'quilômetro' : 'milha'}`
                : 'Pace: informe distância e tempo'
            }
          >
            <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">Pace</Text>
            <Text className="text-5xl font-bold text-white dark:text-black" style={tabular}>
              {mainPace !== undefined ? formatDuration(mainPace) : '--:--'}
            </Text>
            <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">min/{unit}</Text>
          </View>
          <View
            className="flex-1 rounded-xl border-2 border-black p-4 dark:border-white"
            accessible
            accessibilityLabel={
              mainSpeed !== undefined
                ? `Velocidade média: ${mainSpeed.toFixed(1).replace('.', ',')} ${speedUnit}`
                : 'Velocidade média: informe distância e tempo'
            }
          >
            <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">Velocidade</Text>
            <Text className="text-5xl font-bold text-black dark:text-white" style={tabular}>
              {mainSpeed !== undefined ? mainSpeed.toFixed(1).replace('.', ',') : '--'}
            </Text>
            <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">{speedUnit}</Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-2xl font-bold text-black dark:text-white" accessibilityRole="header">
            Projeção de provas
          </Text>
          {races ? (
            <>
              <RaceTable races={races} />
              <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                Estimativa pela fórmula de Riegel. Funciona melhor para provas próximas da distância informada.
              </Text>
            </>
          ) : (
            <Text className="text-base text-neutral-700 dark:text-neutral-300">
              Informe distância e tempo para ver as projeções.
            </Text>
          )}
        </View>

        {pace && duration.ok ? (
          <SaveWorkoutForm distanceKm={pace.distanceKm} durationSeconds={duration.value} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
