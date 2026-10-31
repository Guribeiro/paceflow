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

/** Barras de distância por semana, com a linha da meta. */
export function WeeklyBarChart({ weeks, unit, selected, onSelect, goalMeters }: Props) {
  const spokenUnit = unit === 'km' ? 'quilômetros' : 'milhas';
  return (
    <WeekBars
      weeks={weeks}
      value={(w) => w.distanceMeters}
      spokenValue={(w) =>
        `${distanceInUnit(w.distanceMeters, unit).toFixed(1).replace('.', ',')} ${spokenUnit}, ${w.count} ${
          w.count === 1 ? 'treino' : 'treinos'
        }`
      }
      selected={selected}
      onSelect={onSelect}
      reference={
        goalMeters
          ? {
              value: goalMeters,
              label: `Meta ${formatDistance(goalMeters, unit)} ${unit}`,
              spoken: `Meta semanal: ${formatDistance(goalMeters, unit)} ${spokenUnit}`,
            }
          : null
      }
    />
  );
}

interface WeekBarsProps<T extends { weekStart: string }> {
  weeks: T[];
  value: (week: T) => number;
  /** Leitura da barra depois de "Semana de dd/mm: ". */
  spokenValue: (week: T) => string;
  selected: number;
  onSelect: (index: number) => void;
  /** Linha tracejada de referência (meta, média). */
  reference?: { value: number; label: string; spoken: string } | null;
}

/**
 * Barras por semana. Uma série só (sem legenda: o título nomeia), barra
 * selecionada em laranja e as demais em cinza, ambas com contraste ≥ 3:1 nos
 * dois temas (palette.test.ts); 2 px entre barras, topo arredondado, eixo com 3 rótulos.
 */
export function WeekBars<T extends { weekStart: string }>({
  weeks,
  value,
  spokenValue,
  selected,
  onSelect,
  reference,
}: WeekBarsProps<T>) {
  const maxWeek = Math.max(...weeks.map(value), 0);
  const scaleMax = Math.max(maxWeek, reference?.value ?? 0) * 1.1 || 1;
  const lastIndex = weeks.length - 1;
  const axisIndexes = [0, Math.floor(lastIndex / 2), lastIndex];

  return (
    <View className="gap-1">
      <View className="h-44 flex-row items-end gap-0.5 border-b-2 border-surface-2 dark:border-surface-2-dark">
        {weeks.map((week, index) => {
          const isSelected = index === selected;
          const v = value(week);
          return (
            <Pressable
              key={week.weekStart}
              onPress={() => onSelect(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Semana de ${weekLabel(week.weekStart)}: ${spokenValue(week)}`}
              // Área de toque maior que a barra: a coluna inteira.
              className="h-full flex-1 justify-end active:opacity-70"
            >
              <View
                style={{ height: v > 0 ? Math.max(2, (v / scaleMax) * CHART_HEIGHT) : 0 }}
                className={`rounded-t-md ${isSelected ? 'bg-brand-ink dark:bg-brand-ink-dark' : 'bg-bar dark:bg-bar-dark'}`}
              />
            </Pressable>
          );
        })}

        {reference ? (
          <View
            pointerEvents="none"
            accessible
            accessibilityLabel={reference.spoken}
            style={{ bottom: (reference.value / scaleMax) * CHART_HEIGHT }}
            className="absolute left-0 right-0 border-t-2 border-dashed border-ink dark:border-ink-dark"
          >
            <Text
              className="self-end rounded-md bg-surface px-1 text-sm font-bold text-ink dark:bg-surface-dark dark:text-ink-dark"
              style={display}
            >
              {reference.label}
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
