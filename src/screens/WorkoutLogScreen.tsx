import { useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { EditWorkoutForm } from '../components/EditWorkoutForm';
import { WeekSummaryCard } from '../components/WeekSummaryCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { tabular } from '../components/ui/typography';
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
import { type Shoe, isActiveShoe } from '../domain/shoe';
import { shoeMileage, shoeStatus } from '../domain/shoe-mileage';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useShoes } from '../hooks/useShoes';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useWorkouts } from '../hooks/useWorkouts';

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

function WorkoutDetails({ workout, unit, shoeName }: { workout: Workout; unit: DistanceUnit; shoeName?: string }) {
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
        shoeName && `tênis ${shoeName}`,
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
      {shoeName ? <Text className="text-base text-neutral-700 dark:text-neutral-300">Tênis: {shoeName}</Text> : null}
      {workout.note ? <Text className="text-base text-neutral-800 dark:text-neutral-200">{workout.note}</Text> : null}
    </View>
  );
}

function WorkoutItem({ workout, unit, shoeName }: { workout: Workout; unit: DistanceUnit; shoeName?: string }) {
  const [editing, setEditing] = useState(false);

  return (
    <View className="gap-2 rounded-xl border-2 border-black p-4 dark:border-white">
      {editing ? (
        <EditWorkoutForm workout={workout} unit={unit} onDone={() => setEditing(false)} />
      ) : (
        <>
          <WorkoutDetails workout={workout} unit={unit} shoeName={shoeName} />
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button label="Editar" variant="link" accessibilityLabel="Editar treino" onPress={() => setEditing(true)} />
            <Button
              label="Excluir"
              variant="danger-link"
              accessibilityLabel="Excluir treino"
              onPress={() => confirmRemove(workout, unit)}
            />
          </View>
        </>
      )}
    </View>
  );
}

/** Aviso no topo do diário para tênis ativos perto do limite ou acima dele. */
function ShoeAlerts({ shoes, workouts, unit }: { shoes: Shoe[]; workouts: Workout[]; unit: DistanceUnit }) {
  const alerts = shoes
    .filter(isActiveShoe)
    .map((shoe) => ({ shoe, meters: shoeMileage(shoe, workouts) }))
    .filter(({ shoe, meters }) => shoeStatus(meters, shoe.limitMeters) !== 'ok');
  if (alerts.length === 0) return null;

  return (
    <Card variant="inverted" accessibilityRole="alert">
      {alerts.map(({ shoe, meters }) => (
        <Text key={shoe.id} className="text-base text-neutral-200 dark:text-neutral-800">
          <Text className="font-bold text-white dark:text-black">
            {shoeStatus(meters, shoe.limitMeters) === 'replace' ? 'Hora de trocar' : 'Perto da troca'}
          </Text>
          : {shoe.name} ({formatDistance(meters, unit)} de {formatDistance(shoe.limitMeters, unit)} {unit})
        </Text>
      ))}
    </Card>
  );
}

export function WorkoutLogScreen() {
  const workouts = useWorkouts();
  const [unit] = usePreferredUnit();
  const [goalMeters] = useWeeklyGoal();
  const shoes = useShoes();
  const shoeNames = useMemo(() => new Map(shoes.map((s) => [s.id, s.name])), [shoes]);
  const summary = useMemo(() => summarizeWeek(workouts), [workouts]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <WorkoutItem workout={item} unit={unit} shoeName={item.shoeId ? shoeNames.get(item.shoeId) : undefined} />
          )}
          contentContainerClassName="gap-3 p-4"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="mb-2 gap-3">
              <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
                Diário
              </Text>
              <WeekSummaryCard summary={summary} unit={unit} goalMeters={goalMeters} />
              <ShoeAlerts shoes={shoes} workouts={workouts} unit={unit} />
            </View>
          }
          ListEmptyComponent={
            <Text className="text-lg text-neutral-700 dark:text-neutral-300">
              Nenhum treino ainda. Calcule o pace na Calculadora e toque em “Salvar treino”.
            </Text>
          }
        />
      </KeyboardAware>
    </SafeAreaView>
  );
}
