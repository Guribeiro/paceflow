import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { workoutRepository } from '../data/workouts';
import {
  type DistanceUnit,
  KM_PER_MILE,
  TRACK_DISTANCES,
  describeSeries,
  formatDuration,
  lapStats,
  parseDistance,
  parseDuration,
  parseLapTime,
  spokenDuration,
  splitTimes,
} from '../domain/pace';
import { NOTE_MAX_LENGTH } from '../domain/workout';
import { dateOnDay, recentDays } from '../domain/workout-date';
import { useLargeText } from '../hooks/useLargeText';
import { shoeRepository } from '../data/shoes';
import { suggestedShoeId } from '../domain/shoe-mileage';
import { useShoes } from '../hooks/useShoes';
import { ChoiceChips } from './ChoiceChips';
import { NO_SHOE, ShoePicker } from './ShoePicker';
import { Field } from './Field';
import { usePlaceholderColor } from './placeholder-color';
import { RPE_OPTIONS } from './workout-options';

const tabular = { fontVariant: ['tabular-nums' as const] };

const REP_OPTIONS = [...TRACK_DISTANCES.map((d) => ({ value: String(d), label: `${d} m` })), { value: 'other', label: 'Outra' }];

interface Props {
  unit: DistanceUnit;
  /** Pace de intervalado (s/km) dos paces de treino, se houver um esforço calculado no modo Ritmo. */
  suggestedSecondsPerKm?: number | null;
}

function SplitTable({ unit, suggestedSecondsPerKm }: Props) {
  const [targetText, setTargetText] = useState('');
  const target = parseDuration(targetText);
  const fromText = target.ok && target.value > 0 ? (unit === 'mi' ? target.value / KM_PER_MILE : target.value) : null;
  const secondsPerKm = fromText ?? suggestedSecondsPerKm ?? null;
  const suggestion = suggestedSecondsPerKm
    ? formatDuration(unit === 'mi' ? suggestedSecondsPerKm * KM_PER_MILE : suggestedSecondsPerKm)
    : '3:50';

  return (
    <View className="gap-3">
      <Text className="text-2xl font-bold text-black dark:text-white" accessibilityRole="header">
        Tempo por tiro
      </Text>
      <Field
        label={`Pace-alvo (min/${unit})`}
        value={targetText}
        onChangeText={setTargetText}
        placeholder={suggestion}
        keyboardType="numbers-and-punctuation"
        error={targetText && !fromText ? 'Use mm:ss, ex.: 3:50' : undefined}
        fill={false}
      />
      {!targetText && suggestedSecondsPerKm ? (
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          Usando o pace de intervalado sugerido pelo seu esforço no modo Ritmo.
        </Text>
      ) : null}
      {secondsPerKm ? (
        <View className="flex-row flex-wrap rounded-xl border-2 border-black dark:border-white">
          {splitTimes(secondsPerKm).map(({ distanceMeters, seconds }) => (
            <View
              key={distanceMeters}
              accessible
              accessibilityLabel={`${distanceMeters} metros: ${spokenDuration(seconds)}`}
              className="min-w-20 flex-1 items-center gap-1 p-3"
            >
              <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{distanceMeters} m</Text>
              <Text className="text-2xl font-bold text-black dark:text-white" style={tabular}>
                {formatDuration(seconds)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-base text-neutral-700 dark:text-neutral-300">
          Informe um pace-alvo, ou calcule um esforço no modo Ritmo para usar o pace de intervalado.
        </Text>
      )}
    </View>
  );
}

function SeriesLogger({ unit }: { unit: DistanceUnit }) {
  const placeholderColor = usePlaceholderColor();
  const large = useLargeText();
  const [repChoice, setRepChoice] = useState('400');
  const [otherText, setOtherText] = useState('');
  const [lapText, setLapText] = useState('');
  const [laps, setLaps] = useState<number[]>([]);
  const days = recentDays();
  const [dayKey, setDayKey] = useState(days[0].key);
  const [rpe, setRpe] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const shoes = useShoes();
  const [shoeId, setShoeId] = useState(
    () => suggestedShoeId(workoutRepository.list(), shoeRepository.list()) ?? NO_SHOE,
  );

  const other = parseDistance(otherText);
  const repMeters =
    repChoice === 'other' ? (other.ok && other.value > 0 ? Math.round(other.value) : null) : Number(repChoice);
  const lap = parseLapTime(lapText);
  const stats = repMeters ? lapStats(laps, repMeters) : null;
  const autoNote = stats && repMeters ? describeSeries(stats, repMeters, unit) : '';

  function addLap() {
    if (lap === null) return;
    setLaps((current) => [...current, lap]);
    setLapText('');
    setStatus('idle');
  }

  function save() {
    if (!stats || !repMeters) return;
    const result = workoutRepository.create({
      date: dateOnDay(dayKey),
      distanceMeters: stats.count * repMeters,
      durationSeconds: stats.totalSeconds,
      terrain: 'pista',
      rpe,
      note: note.trim() || autoNote,
      shoeId: shoeId === NO_SHOE ? undefined : shoeId,
    });
    if (result.ok) {
      setStatus('saved');
      setLaps([]);
      setNote('');
      setRpe(undefined);
    } else {
      setStatus('error');
    }
  }

  return (
    <View className="gap-4 rounded-xl border-2 border-black p-4 dark:border-white">
      <Text className="text-2xl font-bold text-black dark:text-white" accessibilityRole="header">
        Registrar série
      </Text>

      <ChoiceChips
        label="Distância de cada tiro"
        options={REP_OPTIONS}
        value={repChoice}
        onChange={(v) => v && setRepChoice(v)}
      />
      {repChoice === 'other' ? (
        <Field
          label="Distância (m)"
          value={otherText}
          onChangeText={setOtherText}
          placeholder="600"
          keyboardType="number-pad"
          error={otherText && !repMeters ? 'Use metros, ex.: 600' : undefined}
          fill={false}
        />
      ) : null}

      <View className={`${large ? 'flex-col' : 'flex-row items-end'} gap-3`}>
        <View className={large ? '' : 'flex-1'}>
          <Field
            label={`Tempo do tiro ${laps.length + 1}`}
            value={lapText}
            onChangeText={setLapText}
            placeholder="1:32 ou 92"
            keyboardType="numbers-and-punctuation"
            error={lapText && lap === null ? 'Use 1:32 ou 92' : undefined}
            fill={false}
          />
        </View>
        <Pressable
          onPress={addLap}
          disabled={lap === null}
          accessibilityRole="button"
          accessibilityState={{ disabled: lap === null }}
          className={`min-h-14 items-center justify-center rounded-xl px-5 ${
            lap !== null ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
          }`}
        >
          <Text
            className={`text-lg font-bold ${lap !== null ? 'text-white dark:text-black' : 'text-neutral-700 dark:text-neutral-300'}`}
          >
            Adicionar volta
          </Text>
        </Pressable>
      </View>

      {laps.length > 0 ? (
        <View className="rounded-xl border-2 border-black dark:border-white">
          {laps.map((seconds, index) => {
            // Melhor e pior marcados por texto, não só por estilo.
            const mark =
              stats && laps.length > 1
                ? index === stats.bestIndex
                  ? ' · melhor'
                  : index === stats.worstIndex
                    ? ' · pior'
                    : ''
                : '';
            return (
              <View
                key={index}
                className={`flex-row items-center justify-between px-4 py-1 ${
                  index > 0 ? 'border-t border-neutral-300 dark:border-neutral-700' : ''
                }`}
              >
                <Text className="text-lg text-black dark:text-white" style={tabular}>
                  {index + 1}. <Text className="font-bold">{formatDuration(seconds)}</Text>
                  {mark}
                </Text>
                <Pressable
                  onPress={() => setLaps((current) => current.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover tiro ${index + 1}`}
                  className="min-h-12 min-w-12 items-center justify-center"
                >
                  <Text className="text-base font-semibold text-red-700 underline dark:text-red-400">Remover</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {stats && repMeters ? (
        <View accessible accessibilityLiveRegion="polite" className="gap-1">
          <Text className="text-lg font-bold text-black dark:text-white" style={tabular}>
            Média {formatDuration(stats.average)} · melhor {formatDuration(stats.best)} · pior {formatDuration(stats.worst)}
          </Text>
          <Text className="text-base text-neutral-700 dark:text-neutral-300" style={tabular}>
            {autoNote}
          </Text>
        </View>
      ) : null}

      {stats ? (
        <>
          <ChoiceChips
            label="Dia"
            options={days.map((d) => ({ value: d.key, label: d.label }))}
            value={dayKey}
            onChange={(v) => v && setDayKey(v)}
          />
          <ChoiceChips label="Esforço percebido (RPE, opcional)" options={RPE_OPTIONS} value={rpe} onChange={setRpe} />
          <ShoePicker shoes={shoes} value={shoeId} onChange={setShoeId} />
          <View className="gap-1">
            <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Nota</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={autoNote}
              placeholderTextColor={placeholderColor}
              accessibilityLabel="Nota"
              className="min-h-12 rounded-xl border-2 border-black px-4 text-lg text-black dark:border-white dark:text-white"
            />
          </View>
          <Pressable
            onPress={save}
            accessibilityRole="button"
            className="min-h-14 items-center justify-center rounded-xl bg-black dark:bg-white"
          >
            <Text className="text-xl font-bold text-white dark:text-black">Salvar série no diário</Text>
          </Pressable>
        </>
      ) : null}

      {status !== 'idle' ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`text-base font-semibold ${status === 'saved' ? 'text-black dark:text-white' : 'text-red-700 dark:text-red-400'}`}
        >
          {status === 'saved' ? '✓ Série salva no diário' : 'Não foi possível salvar a série.'}
        </Text>
      ) : null}
    </View>
  );
}

/** Modo "Tiros" da Calculadora: tempo por tiro para um pace-alvo e registro de séries. */
export function IntervalsMode({ unit, suggestedSecondsPerKm }: Props) {
  return (
    <View className="gap-6">
      <SplitTable unit={unit} suggestedSecondsPerKm={suggestedSecondsPerKm} />
      <SeriesLogger unit={unit} />
    </View>
  );
}
