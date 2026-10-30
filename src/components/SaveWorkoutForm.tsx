import { useState } from 'react';
import { Text } from 'react-native';

import { workoutRepository } from '../data/workouts';
import { NOTE_MAX_LENGTH, type Terrain, type Workout } from '../domain/workout';
import { dateOnDay, recentDays } from '../domain/workout-date';
import { shoeRepository } from '../data/shoes';
import { newRecords, personalRecords } from '../domain/personal-records';
import { suggestedShoeId } from '../domain/shoe-mileage';
import { useShoes } from '../hooks/useShoes';
import { ChoiceChips } from './ChoiceChips';
import { Field } from './Field';
import { recordMessage } from './PersonalRecordsCard';
import { NO_SHOE, ShoePicker } from './ShoePicker';
import { RPE_OPTIONS, TERRAIN_OPTIONS } from './workout-options';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface Props {
  /** null enquanto distância ou tempo estão inválidos: o formulário segue montado e o botão desativa. */
  distanceKm: number | null;
  durationSeconds: number | null;
  /** Valores iniciais (a corrida gravada já chega como "Rua"). */
  initialTerrain?: Terrain;
  initialNote?: string;
  /** Parciais da corrida gravada pelo GPS, salvas junto com o treino. */
  splits?: Pick<Workout, 'splits' | 'splitMeters'>;
  /** Depois de salvar, com a comemoração de recorde (se houver). */
  onSaved?: (celebration: { text: string; spoken: string } | null) => void;
}

export function SaveWorkoutForm({
  distanceKm,
  durationSeconds,
  initialTerrain,
  initialNote = '',
  splits,
  onSaved,
}: Props) {
  const [terrain, setTerrain] = useState<Terrain | undefined>(initialTerrain);
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState(initialNote);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [celebration, setCelebration] = useState<{ text: string; spoken: string } | null>(null);
  // Esforço já salvo: o botão só reativa quando o esforço ou algum campo muda,
  // senão um segundo toque gravaria o mesmo treino de novo.
  const effortKey = distanceKm !== null && durationSeconds !== null ? `${distanceKm}|${durationSeconds}` : null;
  const [savedEffort, setSavedEffort] = useState<string | null>(null);
  const saved = effortKey !== null && savedEffort === effortKey;
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
    if (!terrain || saved || distanceKm === null || durationSeconds === null) return;
    const before = personalRecords(workoutRepository.list());
    const result = workoutRepository.create({
      date: dateOnDay(dayKey),
      distanceMeters: distanceKm * 1000,
      durationSeconds,
      terrain,
      rpe,
      note,
      shoeId: shoeId === NO_SHOE ? undefined : shoeId,
      ...splits,
    });
    if (result.ok) {
      const message = recordMessage(newRecords(before, personalRecords(workoutRepository.list())), before);
      setStatus('saved');
      setCelebration(message);
      setSavedEffort(effortKey);
      setRpe(undefined);
      setNote('');
      onSaved?.(message);
    } else {
      setStatus('error');
    }
  }

  return (
    <Card gap={4} title="Registrar no diário" icon="run">

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
        label={
          effortKey === null
            ? 'Informe distância e tempo'
            : saved
              ? 'Salvo ✓'
              : terrain
                ? 'Salvar treino'
                : 'Escolha o terreno'
        }
        accessibilityLabel={saved ? 'Treino salvo' : undefined}
        onPress={save}
        disabled={effortKey === null || !terrain || saved}
        size="lg"
        accessibilityHint={effortKey !== null && !terrain ? 'Escolha o terreno para salvar' : undefined}
      />

      {status === 'error' || (status === 'saved' && saved) ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            status === 'saved' ? `Treino salvo no diário${celebration ? `. ${celebration.spoken}` : ''}` : undefined
          }
          className={`text-base font-semibold ${
            status === 'saved' ? 'text-ink dark:text-ink-dark' : 'text-red-700 dark:text-red-400'
          }`}
        >
          {status === 'saved'
            ? `✓ Treino salvo no diário${celebration ? `\n${celebration.text}` : ''}`
            : 'Não foi possível salvar o treino.'}
        </Text>
      ) : null}
    </Card>
  );
}
