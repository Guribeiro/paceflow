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
import { useLargeText } from '../hooks/useLargeText';
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
import { Card } from '../components/ui/Card';
import { Disclosure } from '../components/ui/Disclosure';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { StatTile } from '../components/ui/StatTile';

const INCOMPLETE = 'Informe distância e tempo válidos.';

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

  // Depois do primeiro cálculo o registro e as consultas ficam montados: corrigir um
  // dígito do tempo não apaga terreno, RPE e nota nem fecha as seções abertas.
  // (setState durante o render é o padrão do React para estado derivado de props.)
  const [hasResult, setHasResult] = useState(false);
  if (pace && !hasResult) setHasResult(true);

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
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
          <ScreenHeader eyebrow="Ritmo e provas" title="Calculadora" action={<UnitToggle value={unit} onChange={setUnit} />} />

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
              <Card title="Seu treino" icon="timer">
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
              </Card>

              <View className={`${row} gap-3`} testID="calculator-results">
                <StatTile
                  variant="hero"
                  size="lg"
                  label="Pace"
                  value={mainPace !== undefined ? formatDuration(mainPace) : '--:--'}
                  suffix={`min/${unit}`}
                  suffixBelow
                  spoken={
                    mainPace !== undefined
                      ? `${spokenDuration(mainPace)} por ${unit === 'km' ? 'quilômetro' : 'milha'}`
                      : 'informe distância e tempo'
                  }
                  className={cell}
                />
                <StatTile
                  size="lg"
                  label="Velocidade média"
                  value={mainSpeed !== undefined ? mainSpeed.toFixed(1).replace('.', ',') : '--'}
                  suffix={speedUnit}
                  suffixBelow
                  spoken={
                    mainSpeed !== undefined
                      ? `${mainSpeed.toFixed(1).replace('.', ',')} ${speedUnit}`
                      : 'informe distância e tempo'
                  }
                  className={cell}
                />
              </View>

              {/* A ação mais usada logo abaixo do resultado; consultas ficam recolhidas. */}
              {hasResult ? (
                <>
                  <SaveWorkoutForm
                    distanceKm={pace?.distanceKm ?? null}
                    durationSeconds={pace && duration.ok ? duration.value : null}
                  />

                  <Card title="Projeção de provas" icon="flag">
                    <Disclosure showLabel="Ver projeção" hideLabel="Ocultar projeção">
                      {races ? (
                        <>
                          <RaceTable races={races} />
                          <Text className="text-sm text-muted dark:text-muted-dark">
                            Estimativa pela fórmula de Riegel. Funciona melhor para provas próximas da distância informada.
                          </Text>
                        </>
                      ) : (
                        <Text className="text-base text-muted dark:text-muted-dark">{INCOMPLETE}</Text>
                      )}
                    </Disclosure>
                  </Card>

                  <Card title="Paces de treino" icon="speed">
                    <Disclosure showLabel="Ver paces" hideLabel="Ocultar paces">
                      {pace && duration.ok ? (
                        <TrainingPaces distanceKm={pace.distanceKm} durationSeconds={duration.value} unit={unit} />
                      ) : (
                        <Text className="text-base text-muted dark:text-muted-dark">{INCOMPLETE}</Text>
                      )}
                    </Disclosure>
                  </Card>
                </>
              ) : (
                <Text className="text-base text-muted dark:text-muted-dark">
                  Informe distância e tempo para ver o pace, registrar o treino e ver projeções.
                </Text>
              )}
            </>
          ) : (
            <IntervalsMode unit={unit} suggestedSecondsPerKm={suggestedInterval} />
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
