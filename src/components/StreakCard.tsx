import { Text, View } from 'react-native';

import { type DistanceUnit, formatDistance } from '../domain/pace';
import { type Streak, streakLabel } from '../domain/streak';
import { BIG_NUMBER_MAX_SCALE } from '../hooks/useLargeText';
import { useStreak } from '../hooks/useStreak';
import { Card } from './ui/Card';
import { display } from './ui/typography';

/** Texto da comemoração ao salvar; null se o treino não garantiu a semana. */
export function streakMessage(before: Streak, after: Streak): { text: string; spoken: string } | null {
  if (before.currentWeekDone || !after.currentWeekDone) return null;
  const text =
    after.current === 1 ? 'Semana garantida: sequência iniciada!' : `Sequência de ${streakLabel(after.current)}!`;
  return { text: `🔥 ${text}`, spoken: text };
}

function status(streak: Streak, unit: DistanceUnit): string {
  if (streak.currentWeekDone) return 'Semana garantida!';
  const remaining =
    streak.remainingMeters === null ? 'uma corrida' : `${formatDistance(streak.remainingMeters, unit)} ${unit}`;
  return streak.current > 0 ? `Falta ${remaining} para manter a sequência.` : `Falta ${remaining} para começar uma sequência.`;
}

/** Semanas seguidas com a meta batida, no Diário. */
export function StreakCard({ unit }: { unit: DistanceUnit }) {
  const streak = useStreak();
  const text = status(streak, unit);

  return (
    <Card title="Sequência" icon="fire" gap={1}>
      <View
        accessible
        accessibilityLabel={`Sequência: ${streakLabel(streak.current)}. Melhor: ${streakLabel(streak.best)}. ${text}`}
      >
        <Text
          className="text-4xl font-bold text-ink dark:text-ink-dark"
          style={display}
          maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
        >
          {streakLabel(streak.current)}
        </Text>
        <Text className="text-base font-semibold text-ink dark:text-ink-dark">{text}</Text>
        <Text className="text-base text-muted dark:text-muted-dark" style={display}>
          Melhor: {streakLabel(streak.best)}
        </Text>
      </View>
    </Card>
  );
}
