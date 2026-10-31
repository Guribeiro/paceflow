import { useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';

import { hasReminderPermission, requestReminderPermission } from '../data/reminders';
import { type ReminderPreferences, parseTime } from '../domain/reminders';
import { useRaceGoal } from '../hooks/useRaceGoal';
import { useReminderPreferences } from '../hooks/useReminderPreferences';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { ChoiceChips } from './ChoiceChips';
import { TimeField } from './TimeField';
import { WeekdayPicker } from './WeekdayPicker';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Toggle } from './ui/Toggle';

type Kind = 'training' | 'weeklyGoal' | 'race' | 'streak';

const TIME_OPTIONS = ['06:00', '07:00', '18:00'].map((t) => ({ value: t, label: t, spoken: `Às ${t}` }));

/** Lembretes locais deste aparelho: dias de treino, meta da semana, sequência e prova. */
export function RemindersSection() {
  const [prefs, update] = useReminderPreferences();
  const [weeklyGoal] = useWeeklyGoal();
  const [raceGoal] = useRaceGoal();
  const [blocked, setBlocked] = useState(false);
  const [timeText, setTimeText] = useState('');
  const anyOn = prefs.training || prefs.weeklyGoal || prefs.race || prefs.streak;
  const parsedTime = parseTime(timeText);

  // Confere de novo ao voltar das configurações do sistema.
  useEffect(() => {
    if (!anyOn) return;
    const check = () => void hasReminderPermission().then((ok) => setBlocked(!ok));
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, [anyOn]);

  async function toggle(kind: Kind, on: boolean) {
    if (on) {
      const granted = await requestReminderPermission();
      setBlocked(!granted);
      if (!granted) return;
    }
    update({ [kind]: on } as Partial<ReminderPreferences>);
  }

  function saveTime() {
    if (!parsedTime) return;
    update({ time: parsedTime });
    setTimeText('');
  }

  return (
    <Card gap={4} title="Lembretes" icon="bell">

      {blocked ? (
        <Card variant="outline" gap={2}>
          <Text className="text-base font-semibold text-red-700 dark:text-red-400">
            As notificações do PaceFlow estão desativadas. Ative em Configurações › Apps › PaceFlow › Notificações.
          </Text>
          <Button label="Abrir configurações" variant="link" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}

      <Toggle
        label="Dias de treino"
        description={`Nos dias escolhidos, às ${prefs.time}, com o treino do plano quando houver prova-alvo.`}
        value={prefs.training}
        onChange={(on) => void toggle('training', on)}
      />
      {prefs.training ? (
        <View className="gap-4">
          <WeekdayPicker
            label="Dias"
            value={prefs.trainingDays}
            onChange={(trainingDays) => update({ trainingDays })}
          />
          {prefs.trainingDays.length === 0 ? (
            <Text className="text-base text-muted dark:text-muted-dark">Escolha pelo menos um dia.</Text>
          ) : null}
          <ChoiceChips
            label={`Horário: ${prefs.time}`}
            options={TIME_OPTIONS}
            value={TIME_OPTIONS.some((o) => o.value === prefs.time) ? prefs.time : undefined}
            onChange={(time) => time && update({ time })}
          />
          <View className="flex-row flex-wrap items-end gap-3">
            <View className="min-w-36 flex-1">
              <TimeField
                label="Outro horário"
                value={timeText}
                onChangeText={setTimeText}
                kind="clock"
                placeholder="05:45"
                error={timeText && !parsedTime ? 'Use hh:mm, ex.: 05:45' : undefined}
                fill={false}
              />
            </View>
            <Button label="Salvar" accessibilityLabel="Salvar horário" size="lg" onPress={saveTime} disabled={!parsedTime} />
          </View>
        </View>
      ) : null}

      <Toggle
        label="Meta da semana"
        description={
          weeklyGoal
            ? 'Sábado às 9h, só se ainda faltar distância para a meta.'
            : 'Sábado às 9h, se ainda faltar. Defina a meta semanal acima.'
        }
        value={prefs.weeklyGoal}
        onChange={(on) => void toggle('weeklyGoal', on)}
      />

      <Toggle
        label="Sequência em risco"
        description="Domingo às 18h, se a semana ainda não contou para a sequência."
        value={prefs.streak}
        onChange={(on) => void toggle('streak', on)}
      />

      <Toggle
        label="Prova chegando"
        description={
          raceGoal
            ? '7 dias antes e na véspera, às 19h.'
            : '7 dias antes e na véspera, às 19h. Defina a prova-alvo na Evolução.'
        }
        value={prefs.race}
        onChange={(on) => void toggle('race', on)}
      />
    </Card>
  );
}
