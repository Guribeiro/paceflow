import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { SaveWorkoutForm } from '../components/SaveWorkoutForm';
import { Button } from '../components/ui/Button';
import { ButtonRow } from '../components/ui/ButtonRow';
import { Card } from '../components/ui/Card';
import { confirmDestructive } from '../components/ui/confirm';
import { SectionHeader } from '../components/ui/SectionHeader';
import { tabular } from '../components/ui/typography';
import {
  type StartResult,
  discardRunSession,
  finishRunSession,
  pauseRunSession,
  resumeRunSession,
  startRunSession,
} from '../data/run-session';
import { type DistanceUnit, KM_PER_MILE, formatDistance, formatDuration, spokenDuration } from '../domain/pace';
import { type RunState, currentPace, elapsedMs, splitDurations } from '../domain/run-tracker';
import { NOTE_MAX_LENGTH } from '../domain/workout';
import { BIG_NUMBER_MAX_SCALE } from '../hooks/useLargeText';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useRunSession } from '../hooks/useRunSession';

const SPLIT_METERS: Record<DistanceUnit, number> = { km: 1000, mi: KM_PER_MILE * 1000 };
/** Abaixo disso não há treino para registrar (ex.: começou e parou no lugar). */
const MIN_SAVE_METERS = 10;

const START_ERRORS: Record<Exclude<StartResult, 'started'>, string> = {
  denied: 'O PaceFlow precisa da localização para medir a corrida. Toque em Começar e permita o acesso.',
  blocked: 'A localização do PaceFlow está bloqueada. Ative em Configurações › Apps › PaceFlow › Permissões.',
  'gps-off': 'O GPS do aparelho está desligado. Ative a localização e toque em Começar de novo.',
};

/** Unidade das parciais: a da gravação, mesmo que a preferência mude no meio. */
const splitUnit = (run: RunState): DistanceUnit => (run.splitMeters === SPLIT_METERS.km ? 'km' : 'mi');

const perUnit = (secondsPerKm: number, unit: DistanceUnit) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);

function BigNumber({ label, value, suffix, spoken }: { label: string; value: string; suffix?: string; spoken: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${spoken}`} className="min-w-36 flex-1">
      <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">{label}</Text>
      <Text
        className="text-5xl font-bold text-black dark:text-white"
        style={tabular}
        maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
      >
        {value}
        {suffix ? <Text className="text-xl font-semibold"> {suffix}</Text> : null}
      </Text>
    </View>
  );
}

function SplitList({ run }: { run: RunState }) {
  const splits = splitDurations(run);
  const unit = splitUnit(run);
  if (splits.length === 0) return null;
  return (
    <View className="gap-1">
      <SectionHeader level={2}>Parciais</SectionHeader>
      {splits.map((seconds, i) => (
        <View
          key={i}
          accessible
          accessibilityLabel={`${unit === 'km' ? 'Quilômetro' : 'Milha'} ${i + 1}: ${spokenDuration(seconds)}`}
          className="flex-row justify-between"
        >
          <Text className="text-lg text-black dark:text-white">
            {i + 1} {unit}
          </Text>
          <Text className="text-lg font-semibold text-black dark:text-white" style={tabular}>
            {formatDuration(seconds)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ActiveRun({ run, now, unit }: { run: RunState; now: number; unit: DistanceUnit }) {
  const seconds = Math.floor(elapsedMs(run, now) / 1000);
  const pace = currentPace(run);
  const splits = splitDurations(run);
  const lastSplit = splits.at(-1);
  const paused = run.status === 'paused';

  return (
    <View className="gap-6">
      <Card gap={4}>
        {paused ? (
          <Text accessibilityLiveRegion="polite" className="text-lg font-bold text-black dark:text-white">
            ⏸ Pausada
          </Text>
        ) : null}
        <BigNumber label="Tempo" value={formatDuration(seconds)} spoken={spokenDuration(seconds)} />
        <View className="flex-row flex-wrap gap-4">
          <BigNumber
            label="Distância"
            value={formatDistance(run.distanceMeters, unit)}
            suffix={unit}
            spoken={`${formatDistance(run.distanceMeters, unit)} ${unit === 'km' ? 'quilômetros' : 'milhas'}`}
          />
          <BigNumber
            label="Pace atual"
            value={pace !== null ? formatDuration(perUnit(pace, unit)) : '--:--'}
            suffix={`/${unit}`}
            spoken={pace !== null ? `${formatDuration(perUnit(pace, unit))} por ${unit === 'km' ? 'quilômetro' : 'milha'}` : 'sem leitura'}
          />
        </View>
        {lastSplit !== undefined ? (
          <Text className="text-lg text-black dark:text-white" style={tabular}>
            Última parcial ({splits.length} {splitUnit(run)}): {formatDuration(lastSplit)}
          </Text>
        ) : null}
      </Card>

      {paused ? (
        <ButtonRow>
          <Button label="Retomar" size="lg" grow onPress={() => resumeRunSession()} />
          <Button label="Finalizar" variant="secondary" size="lg" grow onPress={() => void finishRunSession()} />
        </ButtonRow>
      ) : (
        <Button label="Pausar" size="lg" onPress={() => pauseRunSession()} />
      )}
      <Text className="text-base text-neutral-700 dark:text-neutral-300">
        {paused
          ? 'Pausada: tempo e distância não contam. Finalize para registrar a corrida.'
          : 'Pode apagar a tela e guardar o celular: a gravação continua. Pause para finalizar.'}
      </Text>
    </View>
  );
}

function FinishedRun({
  run,
  unit,
  onSaved,
}: {
  run: RunState;
  unit: DistanceUnit;
  onSaved: (celebration: { text: string; spoken: string } | null) => void;
}) {
  const seconds = Math.round(run.movingMs / 1000);
  const km = run.distanceMeters / 1000;
  const splits = splitDurations(run);
  const note = splits.length > 0 ? `Parciais (${splitUnit(run)}): ${splits.map(formatDuration).join(', ')}`.slice(0, NOTE_MAX_LENGTH) : '';
  const canSave = run.distanceMeters >= MIN_SAVE_METERS && seconds > 0;
  // Poucos metros de ruído do GPS dariam um pace absurdo (ex.: 10:22:25/mi).
  const average = canSave ? perUnit(seconds / km, unit) : null;

  return (
    <View className="gap-6">
      <Card gap={4}>
        <SectionHeader>Corrida finalizada</SectionHeader>
        <View className="flex-row flex-wrap gap-4">
          <BigNumber
            label="Distância"
            value={formatDistance(run.distanceMeters, unit)}
            suffix={unit}
            spoken={`${formatDistance(run.distanceMeters, unit)} ${unit === 'km' ? 'quilômetros' : 'milhas'}`}
          />
          <BigNumber label="Tempo" value={formatDuration(seconds)} spoken={spokenDuration(seconds)} />
        </View>
        {average !== null ? (
          <Text className="text-lg text-black dark:text-white" style={tabular}>
            Pace médio: {formatDuration(average)}/{unit}
          </Text>
        ) : null}
        <SplitList run={run} />
      </Card>

      {canSave ? (
        <SaveWorkoutForm
          distanceKm={km}
          durationSeconds={seconds}
          initialTerrain="rua"
          initialNote={note}
          onSaved={onSaved}
        />
      ) : (
        <Text className="text-base text-neutral-700 dark:text-neutral-300">
          A corrida ficou curta demais para registrar no diário.
        </Text>
      )}

      <Button
        label="Descartar corrida"
        variant="danger-link"
        onPress={() =>
          confirmDestructive({
            title: 'Descartar a corrida?',
            message: 'Tempo, distância e parciais desta corrida serão apagados.',
            confirmLabel: 'Descartar',
            onConfirm: () => void discardRunSession(),
          })
        }
      />
    </View>
  );
}

export function RunScreen() {
  const [unit] = usePreferredUnit();
  const { run, now } = useRunSession();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<{ celebration: { text: string; spoken: string } | null } | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    setSaved(null);
    try {
      const result = await startRunSession(SPLIT_METERS[unit]);
      if (result !== 'started') setError(START_ERRORS[result]);
    } catch {
      setError('Não foi possível iniciar o GPS. Tente de novo.');
    } finally {
      setStarting(false);
    }
  }

  function handleSaved(celebration: { text: string; spoken: string } | null) {
    setSaved({ celebration });
    void discardRunSession();
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
            Correr
          </Text>

          {run === null ? (
            <View className="gap-6">
              {saved ? (
                <Card gap={1}>
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Corrida salva no diário${saved.celebration ? `. ${saved.celebration.spoken}` : ''}`}
                    className="text-lg font-bold text-black dark:text-white"
                  >
                    {`✓ Corrida salva no diário${saved.celebration ? `\n${saved.celebration.text}` : ''}`}
                  </Text>
                </Card>
              ) : (
                <Text className="text-base text-neutral-700 dark:text-neutral-300">
                  Grava tempo, distância e parciais pelo GPS, com a tela apagada. A rota não é guardada. Comece ao ar
                  livre, com o céu aberto.
                </Text>
              )}
              {error ? (
                <Card gap={2}>
                  <Text accessibilityLiveRegion="polite" className="text-base font-semibold text-red-700 dark:text-red-400">
                    {error}
                  </Text>
                  {error === START_ERRORS.blocked ? (
                    <Button label="Abrir configurações" variant="link" onPress={() => void Linking.openSettings()} />
                  ) : null}
                </Card>
              ) : null}
              <Button label={saved ? 'Nova corrida' : 'Começar'} size="lg" busy={starting} onPress={() => void start()} />
            </View>
          ) : run.status === 'finished' ? (
            <FinishedRun run={run} unit={unit} onSaved={handleSaved} />
          ) : (
            <ActiveRun run={run} now={now} unit={unit} />
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
