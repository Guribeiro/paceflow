import { Text, View } from 'react-native';

import {
  type DistanceUnit,
  KM_PER_MILE,
  type PaceRange,
  type TrainingZone,
  formatDuration,
  spokenDuration,
  trainingPaces,
} from '../domain/pace';

const tabular = { fontVariant: ['tabular-nums' as const] };

const ZONES: { zone: TrainingZone; label: string; hint: string; showLap?: boolean }[] = [
  { zone: 'easy', label: 'Leve / longão', hint: 'Conversa fácil; a maior parte da semana' },
  { zone: 'marathon', label: 'Maratona', hint: 'Ritmo de prova da maratona' },
  { zone: 'threshold', label: 'Limiar', hint: 'Forte e controlado; sustenta ~1 h' },
  { zone: 'interval', label: 'Intervalado', hint: 'Tiros de 3 a 5 min', showLap: true },
  { zone: 'repetition', label: 'Tiros curtos', hint: 'Velocidade; 200 a 400 m', showLap: true },
];

interface Props {
  distanceKm: number;
  durationSeconds: number;
  unit: DistanceUnit;
}

export function TrainingPaces({ distanceKm, durationSeconds, unit }: Props) {
  const result = trainingPaces(distanceKm, durationSeconds);
  const perUnit = (secondsPerKm: number) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const spokenUnit = unit === 'km' ? 'quilômetro' : 'milha';

  if (!result.ok) {
    return (
      <Text className="text-base text-neutral-700 dark:text-neutral-300">
        Para sugerir paces de treino, use um esforço de prova entre 1,5 e 42,2 km, com duração entre 3 minutos e 6 horas.
      </Text>
    );
  }

  const describe = (range: PaceRange) =>
    range.fastest === range.slowest
      ? formatDuration(perUnit(range.fastest))
      : `${formatDuration(perUnit(range.fastest))}–${formatDuration(perUnit(range.slowest))}`;

  return (
    <View className="gap-2">
      <View className="rounded-xl border-2 border-black dark:border-white">
        {ZONES.map(({ zone, label, hint, showLap }, index) => {
          const range = result.value[zone];
          const lap = showLap ? formatDuration(range.fastest * 0.4) : null;
          const spoken =
            range.fastest === range.slowest
              ? spokenDuration(perUnit(range.fastest))
              : `entre ${spokenDuration(perUnit(range.fastest))} e ${spokenDuration(perUnit(range.slowest))}`;
          return (
            <View
              key={zone}
              accessible
              accessibilityLabel={`${label}: ${spoken} por ${spokenUnit}${lap ? `, ${spokenDuration(range.fastest * 0.4)} a cada 400 metros` : ''}. ${hint}`}
              className={`flex-row flex-wrap items-center justify-between gap-x-4 px-4 py-3 ${
                index > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
              }`}
            >
              <View className="shrink">
                <Text className="text-lg font-semibold text-black dark:text-white">{label}</Text>
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">{hint}</Text>
              </View>
              <View className="items-end">
                <Text className="text-xl font-bold text-black dark:text-white" style={tabular}>
                  {describe(range)}/{unit}
                </Text>
                {lap ? (
                  <Text className="text-base text-neutral-700 dark:text-neutral-300" style={tabular}>
                    {lap} por 400 m
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text className="text-sm text-neutral-700 dark:text-neutral-300">
        Estimativas pelas fórmulas de Daniels e Gilbert a partir de um esforço de prova. Use um resultado recente e
        feito no limite.
      </Text>
    </View>
  );
}
