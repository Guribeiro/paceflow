import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { type DistanceUnit, KM_PER_MILE, formatDuration, spokenDuration } from '../domain/pace';
import { type PersonalRecord, personalRecords } from '../domain/personal-records';
import { useWorkouts } from '../hooks/useWorkouts';
import { Card } from './ui/Card';
import { display } from './ui/typography';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Texto da comemoração ao salvar; null se o treino não bateu recorde. */
export function recordMessage(
  records: readonly PersonalRecord[],
  previous: readonly PersonalRecord[],
): { text: string; spoken: string } | null {
  if (records.length === 0) return null;
  const parts = records.map((r) => {
    const first = !previous.some((p) => p.id === r.id);
    return {
      text: `${first ? 'Primeira marca' : 'Novo recorde'} nos ${r.label}: ${formatDuration(r.seconds)}`,
      spoken: `${first ? 'Primeira marca' : 'Novo recorde'} nos ${r.label}: ${spokenDuration(r.seconds)}`,
    };
  });
  return {
    text: `🏆 ${parts.map((p) => p.text).join(' · ')}`,
    spoken: parts.map((p) => p.spoken).join('. '),
  };
}

/** Melhores marcas por distância de prova, na Evolução. */
export function PersonalRecordsCard({ unit }: { unit: DistanceUnit }) {
  const workouts = useWorkouts();
  const records = useMemo(() => personalRecords(workouts), [workouts]);
  const perUnit = (secondsPerKm: number) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);

  return (
    <Card title="Recordes" icon="trophy">
      {records.length === 0 ? (
        <Text className="text-base text-muted dark:text-muted-dark">
          Registre um treino de 5 km, 10 km, meia ou maratona para começar seus recordes.
        </Text>
      ) : (
        records.map((r) => {
          const pace = formatDuration(perUnit(r.seconds / r.distanceKm));
          const date = dateFormatter.format(new Date(r.date));
          return (
            <View
              key={r.id}
              accessible
              accessibilityLabel={`${r.label}: ${spokenDuration(r.seconds)}, pace ${pace} por ${unit === 'km' ? 'quilômetro' : 'milha'}, em ${date}`}
              className="flex-row flex-wrap items-baseline justify-between gap-x-4"
            >
              <Text className="text-lg font-bold text-ink dark:text-ink-dark">{r.label}</Text>
              <Text className="text-lg font-semibold text-ink dark:text-ink-dark" style={display}>
                {formatDuration(r.seconds)} · {pace}/{unit} · {date}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}
