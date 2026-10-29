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
import { SectionHeader } from './ui/SectionHeader';

interface Props {
  distanceKm: number;
  durationSeconds: number;
}

export function SaveWorkoutForm({ distanceKm, durationSeconds }: Props) {
  const [terrain, setTerrain] = useState<Terrain | undefined>();
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  // Esforço já salvo: o botão só reativa quando o esforço ou algum campo muda,
  // senão um segundo toque gravaria o mesmo treino de novo.
  const effortKey = `${distanceKm}|${durationSeconds}`;
  const [savedEffort, setSavedEffort] = useState<string | null>(null);
  const saved = savedEffort === effortKey;
  // Recalculado a cada render: um app aberto desde ontem não oferece "Hoje" errado.
  const days = recentDays();
  const [dayKey, setDayKey] = useState(days[0].key);
  const shoes = useShoes();
  const [shoeId, setShoeId] = useState(
    () => suggestedShoeId(workoutRepository.list(), shoeRepository.list()) ?? NO_SHOE,
  );

  /** Envolve um setter: qualquer mudança libera um novo salvamento. */
  function edited<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setSavedEffort(null);
      setStatus('idle');
    };
  }

  function save() {
    if (!terrain || saved) return;
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
      setSavedEffort(effortKey);
      setRpe(undefined);
      setNote('');
    } else {
      setStatus('error');
    }
  }

  return (
    <View className="gap-4 rounded-xl border-2 border-black p-4 dark:border-white">
      <SectionHeader>Registrar no diário</SectionHeader>

      <ChoiceChips
        label="Dia"
        options={days.map((d) => ({ value: d.key, label: d.label }))}
        value={dayKey}
        onChange={edited((value) => value && setDayKey(value))}
      />
      <ShoePicker shoes={shoes} value={shoeId} onChange={edited(setShoeId)} />
      <ChoiceChips
        label="Terreno"
        options={TERRAIN_OPTIONS}
        value={terrain}
        onChange={edited(setTerrain)}
      />
      <ChoiceChips label="Esforço percebido (RPE, opcional)" options={RPE_OPTIONS} value={rpe} onChange={edited(setRpe)} />

      <Field
        label="Nota (opcional)"
        variant="text"
        value={note}
        onChangeText={edited(setNote)}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Ex.: 8 × 400 m, vento contra"
        fill={false}
      />

      <Button
        label={saved ? 'Salvo ✓' : terrain ? 'Salvar treino' : 'Escolha o terreno'}
        onPress={save}
        disabled={!terrain || saved}
        size="lg"
        accessibilityHint={terrain ? undefined : 'Escolha o terreno para salvar'}
      />

      {status === 'error' || (status === 'saved' && saved) ? (
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
