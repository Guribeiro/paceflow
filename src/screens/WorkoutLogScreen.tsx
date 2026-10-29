import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { workoutRepository } from '../data/workouts';
import { formatDuration, spokenDuration } from '../domain/pace';
import { TERRAIN_LABELS, type Workout } from '../domain/workout';
import { useWorkouts } from '../hooks/useWorkouts';

const tabular = { fontVariant: ['tabular-nums' as const] };

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatKm = (meters: number) => (meters / 1000).toFixed(2).replace('.', ',');

function confirmRemove(workout: Workout) {
  const summary = `${formatKm(workout.distanceMeters)} km em ${formatDuration(workout.durationSeconds)}`;

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

function WorkoutItem({ workout }: { workout: Workout }) {
  const secondsPerKm = workout.durationSeconds / (workout.distanceMeters / 1000);
  const date = dateFormatter.format(new Date(workout.date));

  return (
    <View className="gap-2 rounded-xl border-2 border-black p-4 dark:border-white">
      <View
        accessible
        accessibilityLabel={[
          date,
          `${formatKm(workout.distanceMeters)} quilômetros em ${spokenDuration(workout.durationSeconds)}`,
          `pace de ${spokenDuration(secondsPerKm)} por quilômetro`,
          TERRAIN_LABELS[workout.terrain],
          workout.rpe !== undefined && `esforço ${workout.rpe}`,
          workout.note,
        ]
          .filter(Boolean)
          .join(', ')}
        className="gap-2"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">{date}</Text>
          <Text className="text-base font-bold text-black dark:text-white">
            {TERRAIN_LABELS[workout.terrain]}
            {workout.rpe !== undefined ? ` · RPE ${workout.rpe}` : ''}
          </Text>
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-3xl font-bold text-black dark:text-white" style={tabular}>
            {formatDuration(secondsPerKm)}
            <Text className="text-lg font-semibold">/km</Text>
          </Text>
          <Text className="text-lg font-semibold text-black dark:text-white" style={tabular}>
            {formatKm(workout.distanceMeters)} km · {formatDuration(workout.durationSeconds)}
          </Text>
        </View>
        {workout.note ? <Text className="text-base text-neutral-800 dark:text-neutral-200">{workout.note}</Text> : null}
      </View>
      <Pressable
        onPress={() => confirmRemove(workout)}
        accessibilityRole="button"
        accessibilityLabel="Excluir treino"
        className="min-h-12 items-center justify-center self-end px-2"
      >
        <Text className="text-base font-semibold text-red-700 underline dark:text-red-400">Excluir</Text>
      </Pressable>
    </View>
  );
}

export function WorkoutLogScreen() {
  const workouts = useWorkouts();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => <WorkoutItem workout={item} />}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={
          <Text className="mb-2 text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
            Diário
          </Text>
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
