import { Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance, formatDuration, spokenDuration } from '../domain/pace';
import { goalProgress } from '../domain/weekly-goal';
import type { WeekSummary } from '../domain/workout-summary';
import { BIG_NUMBER_MAX_SCALE } from '../hooks/useLargeText';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { display } from './ui/typography';

interface Props {
  summary: WeekSummary;
  unit: DistanceUnit;
  goalMeters?: number | null;
}

export function WeekSummaryCard({ summary, unit, goalMeters }: Props) {
  const distance = formatDistance(summary.distanceMeters, unit);
  const spokenUnit = unit === 'km' ? 'quilômetros' : 'milhas';
  const treinos = summary.count === 1 ? 'treino' : 'treinos';

  return (
    <Card variant="hero" gap={0}>
      {/* Só o resumo é agrupado: a meta é uma barra de progresso própria, que o
          leitor de tela não anunciaria dentro de um pai acessível. */}
      <View
        accessible
        accessibilityLabel={`Esta semana: ${distanceInUnit(summary.distanceMeters, unit)
          .toFixed(1)
          .replace('.', ',')} ${spokenUnit}, ${summary.count} ${treinos}, ${spokenDuration(summary.durationSeconds)}`}
      >
        <Text className="text-base font-semibold text-white">Esta semana</Text>
        <Text
          className="text-5xl font-bold text-white"
          style={display}
          maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
        >
          {distance}
          <Text className="text-2xl"> {unit}</Text>
        </Text>
        <Text className="text-lg font-semibold text-white" style={display}>
          {summary.count} {treinos} · {formatDuration(summary.durationSeconds)}
        </Text>
      </View>
      {goalMeters ? <GoalProgress distanceMeters={summary.distanceMeters} goalMeters={goalMeters} unit={unit} /> : null}
    </Card>
  );
}

function GoalProgress({ distanceMeters, goalMeters, unit }: { distanceMeters: number; goalMeters: number; unit: DistanceUnit }) {
  const progress = goalProgress(distanceMeters, goalMeters);
  const target = `${formatDistance(goalMeters, unit)} ${unit}`;
  const text = progress.reached
    ? `Meta de ${target} batida! (${progress.percent}%)`
    : `${formatDistance(distanceMeters, unit)} de ${target} · faltam ${formatDistance(progress.remainingMeters, unit)} ${unit}`;

  return (
    <View
      className="mt-3 gap-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Meta semanal: ${text}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(100, progress.percent) }}
    >
      <ProgressBar ratio={progress.ratio} inverted />
      <Text className="text-base font-semibold text-white" style={display}>
        {text}
      </Text>
    </View>
  );
}
