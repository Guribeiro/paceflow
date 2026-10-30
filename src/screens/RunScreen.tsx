import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { RouteMap } from '../components/RouteMap';
import { SaveWorkoutForm } from '../components/SaveWorkoutForm';
import { SplitList } from '../components/SplitList';
import { Button } from '../components/ui/Button';
import { ButtonRow } from '../components/ui/ButtonRow';
import { Card } from '../components/ui/Card';
import { confirmDestructive } from '../components/ui/confirm';
import { Icon } from '../components/ui/Icon';
import { ON_BRAND } from '../components/ui/palette';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatTile } from '../components/ui/StatTile';
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
import { type RunState, currentPace, elapsedMs, isAutoPaused, splitDurations } from '../domain/run-tracker';
import { routePointCount } from '../domain/route';
import { splitUnit } from '../domain/workout';
import { useAutoPause } from '../hooks/useAutoPause';
import { useKeepRoute } from '../hooks/useKeepRoute';
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

/** Décimos de segundo bastam para as parciais guardadas no treino. */
const roundSplit = (seconds: number) => Math.round(seconds * 10) / 10;

const perUnit = (secondsPerKm: number, unit: DistanceUnit) => (unit === 'mi' ? secondsPerKm * KM_PER_MILE : secondsPerKm);

function ActiveRun({ run, now, unit }: { run: RunState; now: number; unit: DistanceUnit }) {
  const seconds = Math.floor(elapsedMs(run, now) / 1000);
  const paused = run.status === 'paused';
  const autoPaused = !paused && isAutoPaused(run, now);
  const pace = autoPaused ? null : currentPace(run);
  const splits = splitDurations(run);
  const lastSplit = splits.at(-1);

  return (
    <View className="gap-4">
      {paused || autoPaused ? (
        <Text
          accessibilityLiveRegion="polite"
          className="self-start overflow-hidden rounded-full bg-brand-soft px-4 py-2 text-lg font-bold text-brand-ink dark:bg-brand-soft-dark dark:text-brand-ink-dark"
        >
          {paused ? '⏸ Pausada' : '⏸ Pausa automática'}
        </Text>
      ) : null}
      <StatTile
        variant="hero"
        size="lg"
        label="Tempo"
        value={formatDuration(seconds)}
        spoken={spokenDuration(seconds)}
        className=""
      />
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          size="lg"
          label="Distância"
          value={formatDistance(run.distanceMeters, unit)}
          suffix={unit}
          suffixBelow
          spoken={`${formatDistance(run.distanceMeters, unit)} ${unit === 'km' ? 'quilômetros' : 'milhas'}`}
        />
        <StatTile
          size="lg"
          label="Pace atual"
          value={pace !== null ? formatDuration(perUnit(pace, unit)) : '--:--'}
          suffix={`min/${unit}`}
          suffixBelow
          spoken={pace !== null ? `${formatDuration(perUnit(pace, unit))} por ${unit === 'km' ? 'quilômetro' : 'milha'}` : 'sem leitura'}
        />
      </View>
      {lastSplit !== undefined ? (
        <Card variant="soft" gap={0}>
          <Text className="text-lg font-semibold text-ink dark:text-ink-dark" style={tabular}>
            Última parcial ({splits.length} {splitUnit(run.splitMeters)}):{' '}
            <Text className="font-bold text-brand-ink dark:text-brand-ink-dark">{formatDuration(lastSplit)}</Text>
          </Text>
        </Card>
      ) : null}

      {paused ? (
        <ButtonRow>
          <Button label="Retomar" size="lg" grow onPress={() => resumeRunSession()} />
          <Button label="Finalizar" variant="secondary" size="lg" grow onPress={() => void finishRunSession()} />
        </ButtonRow>
      ) : (
        <Button label="Pausar" size="lg" onPress={() => pauseRunSession()} />
      )}
      <Text className="text-base text-muted dark:text-muted-dark">
        {paused
          ? 'Pausada: tempo e distância não contam. Finalize para registrar a corrida.'
          : autoPaused
            ? 'Parado: o tempo volta a contar quando você andar de novo.'
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
  const canSave = run.distanceMeters >= MIN_SAVE_METERS && seconds > 0;
  // Poucos metros de ruído do GPS dariam um pace absurdo (ex.: 10:22:25/mi).
  const average = canSave ? perUnit(seconds / km, unit) : null;

  return (
    <View className="gap-4">
      <SectionHeader icon="trophy">Corrida finalizada</SectionHeader>
      <View className="flex-row flex-wrap gap-3">
        <StatTile
          variant="hero"
          size="lg"
          label="Distância"
          value={formatDistance(run.distanceMeters, unit)}
          suffix={unit}
          suffixBelow
          spoken={`${formatDistance(run.distanceMeters, unit)} ${unit === 'km' ? 'quilômetros' : 'milhas'}`}
        />
        <StatTile size="lg" label="Tempo" value={formatDuration(seconds)} spoken={spokenDuration(seconds)} />
      </View>
      {average !== null ? (
        <StatTile
          label="Pace médio"
          value={formatDuration(average)}
          suffix={`/${unit}`}
          spoken={`${formatDuration(average)} por ${unit === 'km' ? 'quilômetro' : 'milha'}`}
          className=""
        />
      ) : null}
      {run.route && routePointCount(run.route) >= 2 ? (
        <Card gap={3} title="Trajeto" icon="route">
          <RouteMap route={run.route} />
        </Card>
      ) : null}
      {splits.length > 0 ? (
        <Card gap={0} title="Parciais" icon="flag">
          <SplitList splits={splits} unit={splitUnit(run.splitMeters)} />
        </Card>
      ) : null}

      {canSave ? (
        <SaveWorkoutForm
          distanceKm={km}
          durationSeconds={seconds}
          initialTerrain="rua"
          splits={splits.length > 0 ? { splits: splits.map(roundSplit), splitMeters: run.splitMeters } : undefined}
          route={run.route}
          onSaved={onSaved}
        />
      ) : (
        <Text className="text-base text-muted dark:text-muted-dark">
          A corrida ficou curta demais para registrar no diário.
        </Text>
      )}

      <Button
        label="Descartar corrida"
        variant="danger-link"
        onPress={() =>
          confirmDestructive({
            title: 'Descartar a corrida?',
            message: 'Tempo, distância, parciais e trajeto desta corrida serão apagados.',
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
  const [autoPause] = useAutoPause();
  const [keepRoute] = useKeepRoute();
  const { run, now } = useRunSession();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saved, setSaved] = useState<{ celebration: { text: string; spoken: string } | null } | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    setSaved(null);
    try {
      const result = await startRunSession(SPLIT_METERS[unit], autoPause, keepRoute);
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
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
          <ScreenHeader eyebrow="Gravar com GPS" title="Correr" />

          {run === null ? (
            <View className="gap-5">
              {saved ? (
                <Card variant="soft" gap={1}>
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Corrida salva no diário${saved.celebration ? `. ${saved.celebration.spoken}` : ''}`}
                    className="text-lg font-bold text-ink dark:text-ink-dark"
                  >
                    {`✓ Corrida salva no diário${saved.celebration ? `\n${saved.celebration.text}` : ''}`}
                  </Text>
                </Card>
              ) : (
                <Card variant="hero" gap={2}>
                  <Icon name="run" color={ON_BRAND} size={56} />
                  <Text className="text-2xl font-extrabold text-white">Pronto para correr?</Text>
                  <Text className="text-base text-white">
                    Grava tempo, distância e parciais pelo GPS, com a tela apagada. A rota não é guardada. Comece ao ar
                    livre, com o céu aberto.
                  </Text>
                </Card>
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
