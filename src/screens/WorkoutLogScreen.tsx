import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { EditWorkoutForm } from '../components/EditWorkoutForm';
import { RouteMap } from '../components/RouteMap';
import { SplitList } from '../components/SplitList';
import { StreakCard } from '../components/StreakCard';
import { WeekSummaryCard } from '../components/WeekSummaryCard';
import { routeRepository } from '../data/routes';
import { workoutRepository } from '../data/workouts';
import {
  type DistanceUnit,
  KM_PER_MILE,
  formatDistance,
  formatDuration,
  spokenDuration,
} from '../domain/pace';
import { TERRAIN_LABELS, type Workout, splitUnit } from '../domain/workout';
import { summarizeWeek } from '../domain/workout-summary';
import { type Shoe, isActiveShoe } from '../domain/shoe';
import { shoeMileage, shoeStatus } from '../domain/shoe-mileage';
import { useCurrentWeek } from '../hooks/useCurrentWeek';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useHasRoute, useRoute } from '../hooks/useRoute';
import { useShoes } from '../hooks/useShoes';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useWorkouts } from '../hooks/useWorkouts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { confirmDestructive } from '../components/ui/confirm';
import { Disclosure } from '../components/ui/Disclosure';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { display } from '../components/ui/typography';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function confirmRemove(workout: Workout, unit: DistanceUnit) {
  confirmDestructive({
    title: 'Excluir treino?',
    message: `${formatDistance(workout.distanceMeters, unit)} ${unit} em ${formatDuration(workout.durationSeconds)}`,
    confirmLabel: 'Excluir',
    onConfirm: () => {
      workoutRepository.remove(workout.id);
      routeRepository.remove(workout.id);
    },
  });
}

/** Selo em pílula (terreno, esforço). */
function Badge({ children }: { children: string }) {
  return (
    <Text className="overflow-hidden rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-ink dark:bg-brand-soft-dark dark:text-brand-ink-dark">
      {children}
    </Text>
  );
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
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-base font-semibold text-muted dark:text-muted-dark">{date}</Text>
        <View className="flex-row gap-2">
          <Badge>{TERRAIN_LABELS[workout.terrain]}</Badge>
          {workout.rpe !== undefined ? <Badge>{`RPE ${workout.rpe}`}</Badge> : null}
        </View>
      </View>
      <View className="flex-row flex-wrap items-end justify-between gap-x-4">
        <Text className="text-4xl font-extrabold text-ink dark:text-ink-dark" style={display}>
          {distance}
          <Text className="text-lg font-semibold"> {unit}</Text>
        </Text>
        <View className="items-end">
          <Text className="text-2xl font-bold text-brand-ink dark:text-brand-ink-dark" style={display}>
            {formatDuration(pace)}
            <Text className="text-base font-semibold">/{unit}</Text>
          </Text>
          <Text className="text-base font-semibold text-muted dark:text-muted-dark" style={display}>
            {formatDuration(workout.durationSeconds)}
          </Text>
        </View>
      </View>
      {shoeName ? <Text className="text-base text-muted dark:text-muted-dark">Tênis: {shoeName}</Text> : null}
      {workout.note ? <Text className="text-base text-ink dark:text-ink-dark">{workout.note}</Text> : null}
    </View>
  );
}

/** Lido só quando o "Ver trajeto" abre; um trajeto corrompido não desenha nada. */
function SavedRoute({ workoutId }: { workoutId: string }) {
  const route = useRoute(workoutId);
  return route ? <RouteMap route={route} /> : null;
}

function WorkoutItem({ workout, unit, shoeName }: { workout: Workout; unit: DistanceUnit; shoeName?: string }) {
  const [editing, setEditing] = useState(false);
  const hasRoute = useHasRoute(workout.id);

  return (
    <Card gap={2}>
      {editing ? (
        <EditWorkoutForm workout={workout} unit={unit} onDone={() => setEditing(false)} />
      ) : (
        <>
          <WorkoutDetails workout={workout} unit={unit} shoeName={shoeName} />
          {workout.splits && workout.splitMeters ? (
            <Disclosure showLabel="Ver parciais" hideLabel="Ocultar parciais">
              <SplitList splits={workout.splits} unit={splitUnit(workout.splitMeters)} />
            </Disclosure>
          ) : null}
          {hasRoute ? (
            <Disclosure showLabel="Ver trajeto" hideLabel="Ocultar trajeto">
              <SavedRoute workoutId={workout.id} />
            </Disclosure>
          ) : null}
          <View className="flex-row flex-wrap justify-end gap-6">
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
    </Card>
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
    <Card variant="soft" accessibilityRole="alert" title="Seus tênis" icon="shoe">
      {alerts.map(({ shoe, meters }) => (
        <Text key={shoe.id} className="text-base text-ink dark:text-ink-dark">
          <Text className="font-bold text-brand-ink dark:text-brand-ink-dark">
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
  const currentWeek = useCurrentWeek();
  // currentWeek: recalcula na virada da semana.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarizeWeek(workouts), [workouts, currentWeek]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <FlatList
          data={workouts}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <WorkoutItem workout={item} unit={unit} shoeName={item.shoeId ? shoeNames.get(item.shoeId) : undefined} />
          )}
          contentContainerClassName="gap-3 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="mb-2 gap-4">
              <ScreenHeader eyebrow="Seus treinos" title="Diário" />
              <WeekSummaryCard summary={summary} unit={unit} goalMeters={goalMeters} />
              <StreakCard unit={unit} />
              <ShoeAlerts shoes={shoes} workouts={workouts} unit={unit} />
              {workouts.length > 0 ? <SectionHeader level={2} icon="calendar">Histórico</SectionHeader> : null}
            </View>
          }
          ListEmptyComponent={
            <Text className="text-lg text-muted dark:text-muted-dark">
              Nenhum treino ainda. Calcule o pace na Calculadora e toque em “Salvar treino”.
            </Text>
          }
        />
      </KeyboardAware>
    </SafeAreaView>
  );
}
