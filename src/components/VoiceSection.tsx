import { Text, View } from 'react-native';

import { previewAnnouncement } from '../data/run-voice';
import { type DistanceUnit, KM_PER_MILE } from '../domain/pace';
import { useVoicePreferences } from '../hooks/useVoicePreferences';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Toggle } from './ui/Toggle';

/** Avisos falados durante a corrida gravada pelo GPS (por aparelho). */
export function VoiceSection({ unit }: { unit: DistanceUnit }) {
  const [prefs, update] = useVoicePreferences();
  const unitName = unit === 'km' ? 'quilômetro' : 'milha';
  const nothingToSay = !prefs.splitTime && !prefs.averagePace && !prefs.totalTime;

  return (
    <Card gap={4} title="Avisos falados" icon="voice">
      <Toggle
        label="Falar a cada parcial"
        description={`Na aba Correr, a cada ${unitName}, mesmo com a tela apagada.`}
        value={prefs.enabled}
        onChange={(enabled) => update({ enabled })}
      />
      {prefs.enabled ? (
        <View className="gap-4">
          <Toggle label="Tempo da parcial" value={prefs.splitTime} onChange={(splitTime) => update({ splitTime })} />
          <Toggle label="Pace médio" value={prefs.averagePace} onChange={(averagePace) => update({ averagePace })} />
          <Toggle label="Tempo total" value={prefs.totalTime} onChange={(totalTime) => update({ totalTime })} />
          {nothingToSay ? (
            <Text className="text-base text-muted dark:text-muted-dark">
              Só o número da parcial será falado. Ligue um item acima para ouvir os tempos.
            </Text>
          ) : null}
          <Button
            label="Ouvir exemplo"
            variant="secondary"
            onPress={() => previewAnnouncement(unit === 'km' ? 1000 : KM_PER_MILE * 1000)}
          />
        </View>
      ) : null}
    </Card>
  );
}
