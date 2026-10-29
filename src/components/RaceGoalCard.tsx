import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import {
  type DistanceUnit,
  KM_PER_MILE,
  RACE_DISTANCES,
  formatDistance,
  formatDuration,
  parseDistance,
  parseDuration,
} from '../domain/pace';
import { dayKeyOf } from '../domain/workout-date';
import { type RaceGoal, parseDateInput, raceGoalSummary } from '../domain/race-goal';
import { useRaceGoal } from '../hooks/useRaceGoal';
import { useWorkouts } from '../hooks/useWorkouts';
import { ChoiceChips } from './ChoiceChips';
import { Field } from './Field';
import { TrainingPaces } from './TrainingPaces';
import { Button } from './ui/Button';
import { tabular } from './ui/typography';
import { Disclosure } from './ui/Disclosure';
import { SectionHeader } from './ui/SectionHeader';

const OTHER = 'other';

const DISTANCE_OPTIONS = [
  ...RACE_DISTANCES.map((r) => ({ value: String(r.distanceKm), label: r.label })),
  { value: OTHER, label: 'Outra' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateLabel = (key: string) => {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};
const raceLabel = (km: number) =>
  RACE_DISTANCES.find((r) => Math.abs(r.distanceKm - km) < 1e-6)?.label ?? `${String(km).replace('.', ',')} km`;

function weeksFromNow(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function confirmRemove(label: string, onConfirm: () => void) {
  const message = 'A contagem, a projeção e o plano somem; os treinos continuam no diário.';
  // No react-native-web o Alert.alert não faz nada; usa o confirm do navegador.
  if (Platform.OS === 'web') {
    if (window.confirm(`Remover a prova (${label})?\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(`Remover a prova (${label})?`, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: onConfirm },
  ]);
}

function RaceGoalForm({ initial, onSave, onCancel }: { initial: RaceGoal | null; onSave: (g: RaceGoal) => void; onCancel: () => void }) {
  const preset = initial && RACE_DISTANCES.some((r) => Math.abs(r.distanceKm - initial.distanceKm) < 1e-6);
  const [distanceChoice, setDistanceChoice] = useState(
    initial ? (preset ? String(initial.distanceKm) : OTHER) : String(RACE_DISTANCES[2].distanceKm),
  );
  const [otherText, setOtherText] = useState(initial && !preset ? String(initial.distanceKm).replace('.', ',') : '');
  const [dateText, setDateText] = useState(initial ? dateLabel(initial.date) : '');
  const [targetText, setTargetText] = useState(initial?.targetSeconds ? formatDuration(initial.targetSeconds) : '');

  const other = parseDistance(otherText);
  const distanceKm = distanceChoice === OTHER ? (other.ok && other.value > 0 ? other.value : null) : Number(distanceChoice);
  const date = parseDateInput(dateText);
  const target = targetText ? parseDuration(targetText) : null;
  const targetOk = !target || (target.ok && target.value > 0);
  const canSave = distanceKm !== null && date !== null && targetOk;

  return (
    <View className="gap-3">
      <ChoiceChips label="Distância" options={DISTANCE_OPTIONS} value={distanceChoice} onChange={(v) => v && setDistanceChoice(v)} />
      {distanceChoice === OTHER ? (
        <Field label="Distância (km)" value={otherText} onChangeText={setOtherText} keyboardType="decimal-pad" placeholder="15" fill={false} />
      ) : null}
      <ChoiceChips
        label="Daqui a"
        options={[4, 8, 12, 16].map((w) => ({ value: weeksFromNow(w), label: `${w} semanas` }))}
        value={dateText}
        onChange={(v) => v && setDateText(v)}
      />
      <Field
        label="Data da prova (dd/mm/aaaa)"
        value={dateText}
        onChangeText={setDateText}
        keyboardType="numbers-and-punctuation"
        placeholder={weeksFromNow(8)}
        error={dateText && !date ? 'Use dd/mm/aaaa, ex.: 23/11/2026' : undefined}
        fill={false}
      />
      <Field
        label="Tempo-alvo (opcional)"
        value={targetText}
        onChangeText={setTargetText}
        keyboardType="numbers-and-punctuation"
        placeholder="1:45:00"
        error={targetOk ? undefined : 'Use h:mm:ss ou mm:ss'}
        fill={false}
      />
      <View className="flex-row flex-wrap gap-3">
        <Button label="Cancelar" variant="secondary" grow onPress={onCancel} />
        <Button
          label="Salvar prova"
          grow
          disabled={!canSave}
          onPress={() =>
            canSave &&
            onSave({ distanceKm: distanceKm!, date: date!, ...(target?.ok && { targetSeconds: target.value }) })
          }
        />
      </View>
    </View>
  );
}

/** Prova-alvo no topo da Evolução: contagem regressiva, meta, projeção atual e paces da meta. */
export function RaceGoalCard({ unit }: { unit: DistanceUnit }) {
  const [goal, setGoal] = useRaceGoal();
  const workouts = useWorkouts();
  const [editing, setEditing] = useState(false);

  const header = (
    <SectionHeader>Rumo à prova</SectionHeader>
  );

  if (editing) {
    return (
      <View className="gap-3 rounded-xl border-2 border-black p-4 dark:border-white">
        {header}
        <RaceGoalForm
          initial={goal}
          onCancel={() => setEditing(false)}
          onSave={(g) => {
            setGoal(g);
            setEditing(false);
          }}
        />
      </View>
    );
  }

  if (!goal) {
    return (
      <View className="gap-3 rounded-xl border-2 border-black p-4 dark:border-white">
        {header}
        <Text className="text-base text-neutral-700 dark:text-neutral-300">
          Defina uma prova para ver a contagem regressiva, o pace-alvo e quanto falta pela sua forma atual.
        </Text>
        <Button label="Definir prova-alvo" onPress={() => setEditing(true)} />
      </View>
    );
  }

  const summary = raceGoalSummary(goal, workouts);
  const perUnit = (secondsPerKm: number) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const countdown = summary.past
    ? `A prova de ${dateLabel(goal.date)} já passou. Que tal definir a próxima?`
    : summary.daysLeft === 0
      ? 'É hoje! Boa prova.'
      : `${dateLabel(goal.date)} · faltam ${summary.daysLeft} ${summary.daysLeft === 1 ? 'dia' : 'dias'}${
          summary.weeksLeft > 0 ? ` (${summary.weeksLeft} ${summary.weeksLeft === 1 ? 'semana' : 'semanas'})` : ''
        }`;

  let projection: string;
  if (summary.projectedSeconds === null) {
    projection = 'Registre um treino forte (1,5 a 42 km) para ver a projeção.';
  } else {
    // Diz qual treino gerou a projeção: um registro errado fica evidente.
    const e = summary.effort;
    const from = e
      ? ` pelo seu treino de ${formatDistance(e.distanceMeters, unit)} ${unit} em ${formatDuration(e.durationSeconds)} (${dateLabel(dayKeyOf(e.date)).slice(0, 5)})`
      : '';
    projection = `Projeção atual: ${formatDuration(summary.projectedSeconds)}${from}`;
    if (summary.deltaSeconds !== null) {
      projection +=
        Math.abs(summary.deltaSeconds) < 1
          ? ' · exatamente na meta'
          : summary.deltaSeconds > 0
            ? ` · faltam ${formatDuration(summary.deltaSeconds)} para a meta`
            : ` · ${formatDuration(-summary.deltaSeconds)} abaixo da meta`;
    }
  }

  return (
    <View className="gap-3 rounded-xl border-2 border-black p-4 dark:border-white">
      {header}
      <View accessible className="gap-1">
        <Text className="text-xl font-bold text-black dark:text-white">{raceLabel(goal.distanceKm)}</Text>
        <Text className="text-base font-semibold text-black dark:text-white">{countdown}</Text>
        {goal.targetSeconds && summary.targetSecondsPerKm ? (
          <Text className="text-base text-black dark:text-white" style={tabular}>
            Meta: {formatDuration(goal.targetSeconds)} · {formatDuration(perUnit(summary.targetSecondsPerKm))}/{unit}
          </Text>
        ) : null}
        <Text className="text-base text-neutral-700 dark:text-neutral-300" style={tabular}>
          {projection}
        </Text>
      </View>

      {goal.targetSeconds && !summary.past ? (
        <Disclosure title="Paces para a meta" showLabel="Ver paces da meta" hideLabel="Ocultar paces da meta" level={2}>
          <TrainingPaces distanceKm={goal.distanceKm} durationSeconds={goal.targetSeconds} unit={unit} />
        </Disclosure>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        <Button label="Editar" variant="secondary" grow onPress={() => setEditing(true)} />
        <Button
          label="Remover"
          variant="danger"
          accessibilityLabel="Remover prova"
          grow
          onPress={() => confirmRemove(raceLabel(goal.distanceKm), () => setGoal(null))}
        />
      </View>
    </View>
  );
}
