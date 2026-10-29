import { useState } from 'react';
import { Text, View } from 'react-native';

import { workoutRepository } from '../data/workouts';
import { NOTE_MAX_LENGTH, type Terrain } from '../domain/workout';
import { dateOnDay, recentDays } from '../domain/workout-date';
import { shoeRepository } from '../data/shoes';
import { suggestedShoeId } from '../domain/shoe-mileage';
import { useShoes } from '../hooks/useShoes';
import { ChoiceChips } from './ChoiceChips';
import { Field } from './Field';
import { Button } from './ui/Button';
import { NO_SHOE, ShoePicker } from './ShoePicker';
import { RPE_OPTIONS, TERRAIN_OPTIONS } from './workout-options';

interface Props {
  distanceKm: number;
  durationSeconds: number;
}

export function SaveWorkoutForm({ distanceKm, durationSeconds }: Props) {
  const [terrain, setTerrain] = useState<Terrain | undefined>();
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  // Recalculado a cada render: um app aberto desde ontem não oferece "Hoje" errado.
  const days = recentDays();
  const [dayKey, setDayKey] = useState(days[0].key);
  const shoes = useShoes();
  const [shoeId, setShoeId] = useState(
    () => suggestedShoeId(workoutRepository.list(), shoeRepository.list()) ?? NO_SHOE,
  );

  function save() {
    if (!terrain) return;
    const result = workoutRepository.create({
      date: dateOnDay(dayKey),
      distanceMeters: distanceKm * 1000,
      durationSeconds,
      terrain,
      rpe,
      note,
      shoeId: shoeId === NO_SHOE ? undefined : shoeId,
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
        label="Dia"
        options={days.map((d) => ({ value: d.key, label: d.label }))}
        value={dayKey}
        onChange={(value) => value && setDayKey(value)}
      />
      <ShoePicker shoes={shoes} value={shoeId} onChange={setShoeId} />
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

      <Field
        label="Nota (opcional)"
        variant="text"
        value={note}
        onChangeText={setNote}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Ex.: 8 × 400 m, vento contra"
        fill={false}
      />

      <Button
        label={terrain ? 'Salvar treino' : 'Escolha o terreno'}
        onPress={save}
        disabled={!terrain}
        size="lg"
        accessibilityHint={terrain ? undefined : 'Escolha o terreno para salvar'}
      />

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
