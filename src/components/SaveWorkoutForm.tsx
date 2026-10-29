import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { workoutRepository } from '../data/workouts';
import { NOTE_MAX_LENGTH, RPE_MAX, RPE_MIN, TERRAINS, TERRAIN_LABELS, type Terrain } from '../domain/workout';
import { ChoiceChips } from './ChoiceChips';

const TERRAIN_OPTIONS = TERRAINS.map((t) => ({ value: t, label: TERRAIN_LABELS[t] }));
const RPE_OPTIONS = Array.from({ length: RPE_MAX - RPE_MIN + 1 }, (_, i) => ({
  value: RPE_MIN + i,
  label: String(RPE_MIN + i),
  spoken: `esforço ${RPE_MIN + i}`,
}));

interface Props {
  distanceKm: number;
  durationSeconds: number;
}

export function SaveWorkoutForm({ distanceKm, durationSeconds }: Props) {
  const [terrain, setTerrain] = useState<Terrain | undefined>();
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  function save() {
    if (!terrain) return;
    const result = workoutRepository.create({
      date: new Date().toISOString(),
      distanceMeters: distanceKm * 1000,
      durationSeconds,
      terrain,
      rpe,
      note,
    });
    if (result.ok) {
      setStatus('saved');
      setRpe(undefined);
      setNote('');
    } else {
      setStatus('error');
    }
  }

  return (
    <View className="gap-4 rounded-xl border-2 border-black p-4 dark:border-white">
      <Text className="text-2xl font-bold text-black dark:text-white" accessibilityRole="header">
        Registrar no diário
      </Text>

      <ChoiceChips
        label="Terreno"
        options={TERRAIN_OPTIONS}
        value={terrain}
        onChange={(value) => {
          setTerrain(value);
          setStatus('idle');
        }}
      />
      <ChoiceChips label="Esforço percebido (RPE, opcional)" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />

      <View className="gap-1">
        <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Nota (opcional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Ex.: 8 × 400 m, vento contra"
          placeholderTextColor="#737373"
          accessibilityLabel="Nota"
          className="min-h-12 rounded-xl border-2 border-black px-4 text-lg text-black dark:border-white dark:text-white"
        />
      </View>

      <Pressable
        onPress={save}
        disabled={!terrain}
        accessibilityRole="button"
        accessibilityState={{ disabled: !terrain }}
        accessibilityHint={terrain ? undefined : 'Escolha o terreno para salvar'}
        className={`min-h-14 items-center justify-center rounded-xl ${
          terrain ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <Text
          className={`text-xl font-bold ${
            terrain ? 'text-white dark:text-black' : 'text-neutral-700 dark:text-neutral-300'
          }`}
        >
          {terrain ? 'Salvar treino' : 'Escolha o terreno'}
        </Text>
      </Pressable>

      {status !== 'idle' ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`text-base font-semibold ${
            status === 'saved' ? 'text-black dark:text-white' : 'text-red-700 dark:text-red-400'
          }`}
        >
          {status === 'saved' ? '✓ Treino salvo no diário' : 'Não foi possível salvar o treino.'}
        </Text>
      ) : null}
    </View>
  );
}
