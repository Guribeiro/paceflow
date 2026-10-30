import { Pressable, Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance } from '../domain/pace';
import type { WeekTotal } from '../domain/workout-trends';
import { display } from './ui/typography';

// Igual a h-44 (176 px): a altura das barras é calculada sobre ele.
const CHART_HEIGHT = 176;

const pad2 = (n: number) => String(n).padStart(2, '0');
export const weekLabel = (weekStart: string) => {
  const d = new Date(weekStart);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

interface Props {
  weeks: WeekTotal[];
  unit: DistanceUnit;
  selected: number;
  onSelect: (index: number) => void;
  goalMeters?: number | null;
}

/**
 * Barras de distância por semana. Uma série só (sem legenda: o título nomeia),
 * barra selecionada em laranja e as demais em cinza, ambas com contraste ≥ 3:1
 * nos dois temas (palette.test.ts); 2 px entre barras, topo arredondado, eixo com 3 rótulos.
 */
export function WeeklyBarChart({ weeks, unit, selected, onSelect, goalMeters }: Props) {
  const maxWeek = Math.max(...weeks.map((w) => w.distanceMeters), 0);
  const scaleMax = Math.max(maxWeek, goalMeters ?? 0) * 1.1 || 1;
  const spokenUnit = unit === 'km' ? 'quilômetros' : 'milhas';
  const lastIndex = weeks.length - 1;
  const axisIndexes = [0, Math.floor(lastIndex / 2), lastIndex];

  return (
    <View className="gap-1">
      <View className="h-44 flex-row items-end gap-0.5 border-b-2 border-surface-2 dark:border-surface-2-dark">
        {weeks.map((week, index) => {
          const isSelected = index === selected;
          const ratio = week.distanceMeters / scaleMax;
          const distance = distanceInUnit(week.distanceMeters, unit).toFixed(1).replace('.', ',');
          return (
            <Pressable
              key={week.weekStart}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Semana de ${weekLabel(week.weekStart)}: ${distance} ${spokenUnit}, ${week.count} ${
                week.count === 1 ? 'treino' : 'treinos'
              }`}
              // Área de toque maior que a barra: a coluna inteira.
              className="h-full flex-1 justify-end active:opacity-70"
            >
              <View
                style={{ height: week.distanceMeters > 0 ? Math.max(2, ratio * CHART_HEIGHT) : 0 }}
                className={`rounded-t-md ${isSelected ? 'bg-brand-ink dark:bg-brand-ink-dark' : 'bg-bar dark:bg-bar-dark'}`}
              />
            </Pressable>
          );
        })}

        {goalMeters ? (
          <View
            pointerEvents="none"
            accessible
            accessibilityLabel={`Meta semanal: ${formatDistance(goalMeters, unit)} ${spokenUnit}`}
            style={{ bottom: (goalMeters / scaleMax) * CHART_HEIGHT }}
            className="absolute left-0 right-0 border-t-2 border-dashed border-ink dark:border-ink-dark"
          >
            <Text
              className="self-end rounded-md bg-surface px-1 text-sm font-bold text-ink dark:bg-surface-dark dark:text-ink-dark"
              style={display}
            >
              Meta {formatDistance(goalMeters, unit)} {unit}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
        {axisIndexes.map((i) => (
          <Text key={i} className="text-sm font-semibold text-muted dark:text-muted-dark">
            {i === lastIndex ? 'Esta semana' : weekLabel(weeks[i].weekStart)}
          </Text>
        ))}
      </View>
    </View>
  );
}
