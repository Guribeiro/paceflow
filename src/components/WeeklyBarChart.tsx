import { Pressable, Text, View } from 'react-native';

import { type DistanceUnit, distanceInUnit, formatDistance } from '../domain/pace';
import type { WeekTotal } from '../domain/workout-trends';

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
 * barra selecionada em cor de texto e as demais em cinza com contraste ≥ 3:1
 * nos dois temas; 2 px entre barras, topo arredondado, eixo com 3 rótulos.
 */
export function WeeklyBarChart({ weeks, unit, selected, onSelect, goalMeters }: Props) {
  const maxWeek = Math.max(...weeks.map((w) => w.distanceMeters), 0);
  const scaleMax = Math.max(maxWeek, goalMeters ?? 0) * 1.1 || 1;
  const spokenUnit = unit === 'km' ? 'quilômetros' : 'milhas';
  const lastIndex = weeks.length - 1;
  const axisIndexes = [0, Math.floor(lastIndex / 2), lastIndex];

  return (
    <View className="gap-1">
      <View style={{ height: CHART_HEIGHT }} className="flex-row items-end gap-0.5 border-b border-neutral-400">
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
              className="h-full flex-1 justify-end"
            >
              <View
                style={{ height: week.distanceMeters > 0 ? Math.max(2, ratio * CHART_HEIGHT) : 0 }}
                className={`rounded-t ${isSelected ? 'bg-black dark:bg-white' : 'bg-[#737373] dark:bg-[#8f8f8f]'}`}
              />
            </Pressable>
          );
        })}

        {goalMeters ? (
          <View
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{ bottom: (goalMeters / scaleMax) * CHART_HEIGHT }}
            className="absolute left-0 right-0 border-t-2 border-dashed border-black dark:border-white"
          >
            <Text className="self-end bg-white px-1 text-xs font-bold text-black dark:bg-black dark:text-white">
              Meta {formatDistance(goalMeters, unit)} {unit}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
        {axisIndexes.map((i) => (
          <Text key={i} className="text-xs text-neutral-700 dark:text-neutral-300">
            {i === lastIndex ? 'Esta semana' : weekLabel(weeks[i].weekStart)}
          </Text>
        ))}
      </View>
    </View>
  );
}
