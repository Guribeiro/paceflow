import { useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackupSection } from '../components/BackupSection';
import { EditWorkoutForm } from '../components/EditWorkoutForm';
import { WeekSummaryCard } from '../components/WeekSummaryCard';
import { workoutRepository } from '../data/workouts';
import {
  type DistanceUnit,
  KM_PER_MILE,
  formatDistance,
  formatDuration,
  spokenDuration,
} from '../domain/pace';
import { TERRAIN_LABELS, type Workout } from '../domain/workout';
import { summarizeWeek } from '../domain/workout-summary';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useWorkouts } from '../hooks/useWorkouts';

const tabular = { fontVariant: ['tabular-nums' as const] };

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function confirmRemove(workout: Workout, unit: DistanceUnit) {
  const summary = `${formatDistance(workout.distanceMeters, unit)} ${unit} em ${formatDuration(workout.durationSeconds)}`;

  // No react-native-web o Alert.alert não faz nada; usa o confirm do navegador.
  if (Platform.OS === 'web') {
    if (window.confirm(`Excluir treino?\n${summary}`)) workoutRepository.remove(workout.id);
    return;
  }

  Alert.alert('Excluir treino?', summary, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => workoutRepository.remove(workout.id) },
  ]);
}

function WorkoutDetails({ workout, unit }: { workout: Workout; unit: DistanceUnit }) {
  const secondsPerKm = workout.durationSeconds / (workout.distanceMeters / 1000);
  const pace = unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm;
  const spokenUnit = unit === 'km' ? 'quilômetro' : 'milha';
  const distance = formatDistance(workout.distanceMeters, unit);
  const date = dateFormatter.format(new Date(workout.date));

  return (
    <View
      accessible
      accessibilityLabel={[
        date,
        `${distance} ${unit === 'km' ? 'quilômetros' : 'milhas'} em ${spokenDuration(workout.durationSeconds)}`,
        `pace de ${spokenDuration(pace)} por ${spokenUnit}`,
        TERRAIN_LABELS[workout.terrain],
        workout.rpe !== undefined && `esforço ${workout.rpe}`,
        workout.note,
      ]
        .filter(Boolean)
        .join(', ')}
      className="gap-2"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-x-4">
        <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">{date}</Text>
        <Text className="text-base font-bold text-black dark:text-white">
          {TERRAIN_LABELS[workout.terrain]}
          {workout.rpe !== undefined ? ` · RPE ${workout.rpe}` : ''}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-end justify-between gap-x-4">
        <Text className="text-3xl font-bold text-black dark:text-white" style={tabular}>
          {formatDuration(pace)}
          <Text className="text-lg font-semibold">/{unit}</Text>
        </Text>
        <Text className="text-lg font-semibold text-black dark:text-white" style={tabular}>
          {distance} {unit} · {formatDuration(workout.durationSeconds)}
        </Text>
      </View>
      {workout.note ? <Text className="text-base text-neutral-800 dark:text-neutral-200">{workout.note}</Text> : null}
    </View>
  );
}

function WorkoutItem({ workout, unit }: { workout: Workout; unit: DistanceUnit }) {
  const [editing, setEditing] = useState(false);

  return (
    <View className="gap-2 rounded-xl border-2 border-black p-4 dark:border-white">
      {editing ? (
        <EditWorkoutForm workout={workout} unit={unit} onDone={() => setEditing(false)} />
      ) : (
        <>
          <WorkoutDetails workout={workout} unit={unit} />
          <View className="flex-row flex-wrap justify-end gap-2">
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="Editar treino"
              className="min-h-12 items-center justify-center px-3"
            >
              <Text className="text-base font-semibold text-black underline dark:text-white">Editar</Text>
            </Pressable>
            <Pressable
              onPress={() => confirmRemove(workout, unit)}
              accessibilityRole="button"
              accessibilityLabel="Excluir treino"
              className="min-h-12 items-center justify-center px-3"
            >
              <Text className="text-base font-semibold text-red-700 underline dark:text-red-400">Excluir</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export function WorkoutLogScreen() {
  const workouts = useWorkouts();
  const [unit] = usePreferredUnit();
  const summary = useMemo(() => summarizeWeek(workouts), [workouts]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => <WorkoutItem workout={item} unit={unit} />}
        contentContainerClassName="gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
              Diário
            </Text>
            <WeekSummaryCard summary={summary} unit={unit} />
            <BackupSection canExport={workouts.length > 0} />
          </View>
        }
        ListEmptyComponent={
          <Text className="text-lg text-neutral-700 dark:text-neutral-300">
            Nenhum treino ainda. Calcule o pace na Calculadora e toque em “Salvar treino”.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
