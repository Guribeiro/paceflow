import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { workoutRepository } from '../data/workouts';
import {
  type DistanceUnit,
  distanceInUnit,
  formatDuration,
  parseDistance,
  parseDuration,
  toKilometers,
} from '../domain/pace';
import { NOTE_MAX_LENGTH, type Workout } from '../domain/workout';
import { dateOnDay, dayKeyOf, recentDays } from '../domain/workout-date';
import { useShoes } from '../hooks/useShoes';
import { ChoiceChips } from './ChoiceChips';
import { NO_SHOE, ShoePicker } from './ShoePicker';
import { Field } from './Field';
import { RPE_OPTIONS, TERRAIN_OPTIONS } from './workout-options';

interface Props {
  workout: Workout;
  unit: DistanceUnit;
  onDone: () => void;
}

export function EditWorkoutForm({ workout, unit, onDone }: Props) {
  const [distanceText, setDistanceText] = useState(() =>
    String(Number(distanceInUnit(workout.distanceMeters, unit).toFixed(3))).replace('.', ','),
  );
  const [durationText, setDurationText] = useState(() => formatDuration(workout.durationSeconds));
  const [terrain, setTerrain] = useState(workout.terrain);
  const [rpe, setRpe] = useState<number | undefined>(workout.rpe);
  const [note, setNote] = useState(workout.note ?? '');
  const [failed, setFailed] = useState(false);
  const shoes = useShoes();
  const [shoeId, setShoeId] = useState(workout.shoeId ?? NO_SHOE);
  const originalDayKey = dayKeyOf(workout.date);
  const [dayKey, setDayKey] = useState(originalDayKey);

  // Treinos com mais de 7 dias mantêm a data deles como opção extra.
  const dayOptions = recentDays().map((d) => ({ value: d.key, label: d.label }));
  if (!dayOptions.some((d) => d.value === originalDayKey)) {
    const [y, m, d] = originalDayKey.split('-');
    dayOptions.push({ value: originalDayKey, label: `${d}/${m}/${y}` });
  }

  const distance = parseDistance(distanceText);
  const duration = parseDuration(durationText);
  const distanceError = !distance.ok || distance.value <= 0 ? 'Distância inválida' : undefined;
  const durationError = !duration.ok || duration.value <= 0 ? 'Use mm:ss ou h:mm:ss' : undefined;
  const canSave = !distanceError && !durationError;

  function save() {
    if (!distance.ok || !duration.ok) return;
    const result = workoutRepository.update(workout.id, {
      // Mesmo dia: preserva a hora original em vez de trocar pela atual.
      ...(dayKey !== originalDayKey && { date: dateOnDay(dayKey) }),
      distanceMeters: toKilometers(distance.value, unit) * 1000,
      durationSeconds: duration.value,
      terrain,
      rpe: rpe ?? null,
      note: note.trim() ? note : null,
      shoeId: shoeId === NO_SHOE ? null : shoeId,
    });
    if (result.ok) onDone();
    else setFailed(true);
  }

  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <Field
          label={`Distância (${unit})`}
          value={distanceText}
          onChangeText={setDistanceText}
          keyboardType="decimal-pad"
          error={distanceError}
        />
        <Field
          label="Tempo"
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="numbers-and-punctuation"
          error={durationError}
        />
      </View>

      <ChoiceChips label="Dia" options={dayOptions} value={dayKey} onChange={(v) => v && setDayKey(v)} />
      <ShoePicker shoes={shoes} value={shoeId} onChange={setShoeId} keepId={workout.shoeId} />
      <ChoiceChips label="Terreno" options={TERRAIN_OPTIONS} value={terrain} onChange={(v) => v && setTerrain(v)} />
      <ChoiceChips label="Esforço percebido (RPE)" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />

      <View className="gap-1">
        <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Nota</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX_LENGTH}
          accessibilityLabel="Nota"
          className="min-h-12 rounded-xl border-2 border-black px-4 text-lg text-black dark:border-white dark:text-white"
        />
      </View>

      {failed ? (
        <Text accessibilityLiveRegion="polite" className="text-base font-semibold text-red-700 dark:text-red-400">
          Não foi possível salvar as alterações.
        </Text>
      ) : null}

      <View className="flex-row gap-3">
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          className="min-h-14 flex-1 items-center justify-center rounded-xl border-2 border-black dark:border-white"
        >
          <Text className="text-lg font-bold text-black dark:text-white">Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          className={`min-h-14 flex-1 items-center justify-center rounded-xl ${
            canSave ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
          }`}
        >
          <Text
            className={`text-lg font-bold ${
              canSave ? 'text-white dark:text-black' : 'text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Salvar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
