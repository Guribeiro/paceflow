import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { ChoiceChips } from '../components/ChoiceChips';
import { Field } from '../components/Field';
import { IntervalsMode } from '../components/IntervalsMode';
import { RaceTable } from '../components/RaceTable';
import { SaveWorkoutForm } from '../components/SaveWorkoutForm';
import { TrainingPaces } from '../components/TrainingPaces';
import { UnitToggle } from '../components/UnitToggle';
import { tabular } from '../components/ui/typography';
import { BIG_NUMBER_MAX_SCALE, useLargeText } from '../hooks/useLargeText';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import {
  calculatePace,
  formatDuration,
  parseDistance,
  parseDuration,
  predictRaceTimes,
  spokenDuration,
  trainingPaces,
} from '../domain/pace';


export function CalculatorScreen() {
  const [unit, setUnit] = usePreferredUnit();
  // Com fonte grande, o que fica lado a lado passa a empilhar.
  const large = useLargeText();
  const row = large ? 'flex-col' : 'flex-row';
  const cell = large ? '' : 'flex-1';
  const [mode, setMode] = useState<'pace' | 'intervals'>('pace');
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

  // O pace de intervalado do esforço calculado vira a sugestão do modo Tiros.
  const suggestedInterval = useMemo(() => {
    if (!pace || !duration.ok) return null;
    const result = trainingPaces(pace.distanceKm, duration.value);
    return result.ok ? result.value.interval.fastest : null;
  }, [pace, duration]);

  // Só mostra erro depois que o usuário digitou algo.
  const distanceError = distanceText && !distance.ok ? 'Use um número, ex.: 5 ou 21,1' : undefined;
  const durationError = durationText && !duration.ok ? 'Use mm:ss ou h:mm:ss' : undefined;

  const mainPace = unit === 'km' ? pace?.secondsPerKm : pace?.secondsPerMile;
  const mainSpeed = unit === 'km' ? pace?.kmh : pace?.mph;
  const speedUnit = unit === 'km' ? 'km/h' : 'mph';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
          <View className={`${large ? 'flex-col items-start gap-3' : 'flex-row items-center justify-between'}`}>
            <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
              Calculadora
            </Text>
            <UnitToggle value={unit} onChange={setUnit} />
          </View>

          <ChoiceChips
            label="Modo"
            options={[
              { value: 'pace' as const, label: 'Ritmo' },
              { value: 'intervals' as const, label: 'Tiros' },
            ]}
            value={mode}
            onChange={(v) => v && setMode(v)}
          />

          {mode === 'pace' ? (
            <>
              <View className={`${row} gap-3`} testID="calculator-fields">
                <Field
                  label={`Distância (${unit})`}
                  value={distanceText}
                  onChangeText={setDistanceText}
                  placeholder="5"
                  keyboardType="decimal-pad"
                  error={distanceError}
                  fill={!large}
                />
                <Field
                  label="Tempo"
                  value={durationText}
                  onChangeText={setDurationText}
                  placeholder="25:00"
                  keyboardType="numbers-and-punctuation"
                  error={durationError}
                  fill={!large}
                />
              </View>

              <View className={`${row} gap-3`} testID="calculator-results">
                <View
                  className={`${cell} rounded-xl bg-black p-4 dark:bg-white`}
                  accessible
                  accessibilityLabel={
                    mainPace !== undefined
                      ? `Pace: ${spokenDuration(mainPace)} por ${unit === 'km' ? 'quilômetro' : 'milha'}`
                      : 'Pace: informe distância e tempo'
                  }
                >
                  <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">Pace</Text>
                  <Text
                    className="text-5xl font-bold text-white dark:text-black"
                    style={tabular}
                    maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
                  >
                    {mainPace !== undefined ? formatDuration(mainPace) : '--:--'}
                  </Text>
                  <Text className="text-base font-semibold text-neutral-300 dark:text-neutral-700">min/{unit}</Text>
                </View>
                <View
                  className={`${cell} rounded-xl border-2 border-black p-4 dark:border-white`}
                  accessible
                  accessibilityLabel={
                    mainSpeed !== undefined
                      ? `Velocidade média: ${mainSpeed.toFixed(1).replace('.', ',')} ${speedUnit}`
                      : 'Velocidade média: informe distância e tempo'
                  }
                >
                  <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">Velocidade</Text>
                  <Text
                    className="text-5xl font-bold text-black dark:text-white"
                    style={tabular}
                    maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
                  >
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
                <View className="gap-2">
                  <Text className="text-2xl font-bold text-black dark:text-white" accessibilityRole="header">
                    Paces de treino
                  </Text>
                  <TrainingPaces distanceKm={pace.distanceKm} durationSeconds={duration.value} unit={unit} />
                </View>
              ) : null}

              {pace && duration.ok ? (
                <SaveWorkoutForm distanceKm={pace.distanceKm} durationSeconds={duration.value} />
              ) : null}
            </>
          ) : (
            <IntervalsMode unit={unit} suggestedSecondsPerKm={suggestedInterval} />
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
