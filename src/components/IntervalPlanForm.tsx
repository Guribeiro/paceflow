import { useState } from 'react';
import { Text, View } from 'react-native';

import { type IntervalPlan, MAX_REPS, type Measure, describeMeasure, describePlan, parseMeasure } from '../domain/interval-plan';
import { type DistanceUnit, KM_PER_MILE, formatDuration, parseDistance, parseDuration } from '../domain/pace';
import { ChoiceChips } from './ChoiceChips';
import { Field } from './Field';
import { TimeField } from './TimeField';
import { Card } from './ui/Card';

const OTHER = 'other';
const NONE = 'none';
const REP_OPTIONS = [4, 5, 6, 8, 10, 12];

interface Presets {
  distance: number[];
  /** Segundos. */
  time: number[];
}

const WORK_PRESETS: Presets = { distance: [200, 400, 800, 1000], time: [30, 60, 120, 180] };
const RECOVERY_PRESETS: Presets = { distance: [100, 200, 400], time: [30, 60, 90, 120] };
const EASY_PRESETS: Presets = { distance: [1000, 2000, 3000], time: [5 * 60, 10 * 60, 15 * 60] };

const presetValue = (measure: Measure) => (measure.kind === 'distance' ? measure.meters : measure.seconds);

/** Medida digitada em "Outro": metros ou mm:ss, dentro dos limites do plano. */
function typedMeasure(kind: Measure['kind'], text: string): Measure | null {
  if (kind === 'distance') {
    const meters = parseDistance(text);
    return meters.ok ? parseMeasure({ kind, meters: Math.round(meters.value) }) : null;
  }
  const seconds = parseDuration(text);
  return seconds.ok ? parseMeasure({ kind, seconds: seconds.value }) : null;
}

function MeasureField({
  label,
  value,
  onChange,
  presets,
  optional = false,
  noneLabel = 'Sem',
}: {
  label: string;
  value: Measure | null;
  onChange: (value: Measure | null) => void;
  presets: Presets;
  optional?: boolean;
  noneLabel?: string;
}) {
  const custom = value !== null && !presets[value.kind].includes(presetValue(value));
  const [otherOpen, setOtherOpen] = useState(custom);
  const [otherText, setOtherText] = useState(
    value === null || !custom ? '' : value.kind === 'distance' ? String(value.meters) : formatDuration(value.seconds),
  );

  const kinds = [
    ...(optional ? [{ value: NONE, label: noneLabel }] : []),
    { value: 'distance', label: 'Distância' },
    { value: 'time', label: 'Tempo' },
  ];

  function chooseKind(kind: string | undefined) {
    if (!kind) return;
    setOtherOpen(false);
    setOtherText('');
    if (kind === NONE) onChange(null);
    else if (kind === 'distance') onChange({ kind: 'distance', meters: presets.distance[0] });
    else onChange({ kind: 'time', seconds: presets.time[0] });
  }

  function choosePreset(choice: string | undefined) {
    if (!choice || value === null) return;
    if (choice === OTHER) {
      setOtherOpen(true);
      return;
    }
    setOtherOpen(false);
    setOtherText('');
    onChange(value.kind === 'distance' ? { kind: 'distance', meters: Number(choice) } : { kind: 'time', seconds: Number(choice) });
  }

  function typeOther(text: string) {
    setOtherText(text);
    const measure = value === null ? null : typedMeasure(value.kind, text);
    if (measure) onChange(measure);
  }

  const otherInvalid = value !== null && otherText !== '' && typedMeasure(value.kind, otherText) === null;
  const presetOptions =
    value === null
      ? []
      : [
          ...presets[value.kind].map((v) => {
            const measure: Measure = value.kind === 'distance' ? { kind: 'distance', meters: v } : { kind: 'time', seconds: v };
            return { value: String(v), label: describeMeasure(measure) };
          }),
          { value: OTHER, label: 'Outro' },
        ];

  return (
    <View className="gap-3">
      <ChoiceChips label={label} options={kinds} value={value === null ? NONE : value.kind} onChange={chooseKind} />
      {value !== null ? (
        <ChoiceChips
          label={`${label}: ${describeMeasure(value)}`}
          options={presetOptions}
          value={otherOpen ? OTHER : String(presetValue(value))}
          onChange={choosePreset}
        />
      ) : null}
      {value !== null && otherOpen ? (
        value.kind === 'distance' ? (
          <Field
            label={`${label}: metros`}
            value={otherText}
            onChangeText={typeOther}
            keyboardType="number-pad"
            placeholder="600"
            error={otherInvalid ? 'De 50 a 10000 m' : undefined}
            fill={false}
          />
        ) : (
          <TimeField
            label={`${label}: mm:ss`}
            value={otherText}
            onChangeText={typeOther}
            placeholder="1:30"
            error={otherInvalid ? 'Use mm:ss, de 0:10 a 30:00' : undefined}
            fill={false}
          />
        )
      ) : null}
    </View>
  );
}

interface Props {
  plan: IntervalPlan;
  onChange: (plan: IntervalPlan) => void;
  unit: DistanceUnit;
}

/** Monta o treino intervalado da aba Correr. */
export function IntervalPlanForm({ plan, onChange, unit }: Props) {
  const toUnit = (secondsPerKm: number) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const [repsText, setRepsText] = useState(REP_OPTIONS.includes(plan.reps) ? '' : String(plan.reps));
  const [repsOther, setRepsOther] = useState(!REP_OPTIONS.includes(plan.reps));
  const [targetText, setTargetText] = useState(
    plan.targetSecondsPerKm === null ? '' : formatDuration(Math.round(toUnit(plan.targetSecondsPerKm))),
  );
  const update = (change: Partial<IntervalPlan>) => onChange({ ...plan, ...change });

  function chooseReps(choice: string | undefined) {
    if (!choice) return;
    if (choice === OTHER) {
      setRepsOther(true);
      return;
    }
    setRepsOther(false);
    setRepsText('');
    update({ reps: Number(choice) });
  }

  function typeReps(text: string) {
    setRepsText(text);
    const reps = Number(text);
    if (Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS) update({ reps });
  }

  function typeTarget(text: string) {
    setTargetText(text);
    if (text === '') {
      update({ targetSecondsPerKm: null });
      return;
    }
    const parsed = parseDuration(text);
    if (parsed.ok && parsed.value > 0) {
      update({ targetSecondsPerKm: unit === 'mi' ? parsed.value / KM_PER_MILE : parsed.value });
    }
  }

  const repsNumber = Number(repsText);
  const repsError =
    repsOther && repsText !== '' && !(Number.isInteger(repsNumber) && repsNumber >= 1 && repsNumber <= MAX_REPS)
      ? `De 1 a ${MAX_REPS}`
      : undefined;
  const targetError = targetText !== '' && !parseDuration(targetText).ok ? 'Use mm:ss, ex.: 3:50' : undefined;

  return (
    <Card gap={4} title="Treino intervalado" icon="timer">
      <Text
        accessibilityLiveRegion="polite"
        className="text-base font-semibold text-ink dark:text-ink-dark"
      >
        {describePlan(plan, unit)}
      </Text>

      <MeasureField
        label="Aquecimento"
        value={plan.warmup}
        onChange={(warmup) => update({ warmup })}
        presets={EASY_PRESETS}
        optional
      />

      <ChoiceChips
        label={`Tiros: ${plan.reps}`}
        options={[...REP_OPTIONS.map((n) => ({ value: String(n), label: String(n) })), { value: OTHER, label: 'Outro' }]}
        value={repsOther ? OTHER : String(plan.reps)}
        onChange={chooseReps}
      />
      {repsOther ? (
        <Field
          label="Quantidade de tiros"
          value={repsText}
          onChangeText={typeReps}
          keyboardType="number-pad"
          placeholder="15"
          error={repsError}
          fill={false}
        />
      ) : null}

      <MeasureField label="Tiro" value={plan.work} onChange={(work) => work && update({ work })} presets={WORK_PRESETS} />
      <MeasureField
        label="Recuperação"
        value={plan.recovery}
        onChange={(recovery) => update({ recovery })}
        presets={RECOVERY_PRESETS}
        optional
      />
      <MeasureField
        label="Desaquecimento"
        value={plan.cooldown}
        onChange={(cooldown) => update({ cooldown })}
        presets={EASY_PRESETS}
        optional
      />

      <TimeField
        label={`Pace-alvo do tiro (min/${unit}, opcional)`}
        value={targetText}
        onChangeText={typeTarget}
        placeholder="3:50"
        error={targetError}
        fill={false}
      />
      <Text className="text-sm text-muted dark:text-muted-dark">
        A voz anuncia cada fase, avisa 10 segundos antes de cada tiro e, com pace-alvo, diz na metade do tiro se é para
        acelerar ou segurar. A pausa automática fica desligada no intervalado.
      </Text>
    </Card>
  );
}
