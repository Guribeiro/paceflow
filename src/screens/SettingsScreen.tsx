import Constants from 'expo-constants';
import { Linking, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { RemindersSection } from '../components/RemindersSection';
import { AccountSection } from '../components/AccountSection';
import { BackupSection } from '../components/BackupSection';
import { ChoiceChips } from '../components/ChoiceChips';
import { ShoesSection } from '../components/ShoesSection';
import { VoiceSection } from '../components/VoiceSection';
import { WeeklyGoalSetting } from '../components/WeeklyGoalSetting';
import type { ThemePreference } from '../data/repositories/preferences-repository';
import type { DistanceUnit } from '../domain/pace';
import { useAutoPause } from '../hooks/useAutoPause';
import { useKeepRoute } from '../hooks/useKeepRoute';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useThemePreference } from '../hooks/useThemePreference';
import { useWorkouts } from '../hooks/useWorkouts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { ScreenHeader } from '../components/ui/ScreenHeader';

/** Política de privacidade publicada no GitHub Pages (docs/ do repositório). */
export const PRIVACY_POLICY_URL = 'https://guribeiro.github.io/paceflow/privacidade.html';

const THEME_OPTIONS: { value: ThemePreference; label: string; spoken: string }[] = [
  { value: 'system', label: 'Sistema', spoken: 'Tema do sistema' },
  { value: 'light', label: 'Claro', spoken: 'Tema claro' },
  { value: 'dark', label: 'Escuro', spoken: 'Tema escuro' },
];

const UNIT_OPTIONS: { value: DistanceUnit; label: string; spoken: string }[] = [
  { value: 'km', label: 'Quilômetros', spoken: 'Quilômetros' },
  { value: 'mi', label: 'Milhas', spoken: 'Milhas' },
];

export function SettingsScreen() {
  const [theme, setTheme] = useThemePreference();
  const [unit, setUnit] = usePreferredUnit();
  const [autoPause, setAutoPause] = useAutoPause();
  const [keepRoute, setKeepRoute] = useKeepRoute();
  const workouts = useWorkouts();

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top', 'left', 'right']}>
      <KeyboardAware>
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
          <ScreenHeader eyebrow="Seu PaceFlow" title="Ajustes" />

          {/* Seleção obrigatória: tocar na opção ativa não desmarca. */}
          <Card gap={4} title="Aparência" icon="palette">
            <ChoiceChips label="Tema" options={THEME_OPTIONS} value={theme} onChange={(v) => v && setTheme(v)} />
            <ChoiceChips label="Unidade" options={UNIT_OPTIONS} value={unit} onChange={(v) => v && setUnit(v)} />
          </Card>
          <WeeklyGoalSetting unit={unit} />
          <RemindersSection />
          <Card gap={4} title="Corrida" icon="run">
            <Toggle
              label="Pausa automática"
              description="Na aba Correr, o tempo para quando você fica parado (num semáforo, por exemplo) e volta quando você anda."
              value={autoPause}
              onChange={setAutoPause}
            />
            <Toggle
              label="Guardar trajeto"
              description="O desenho do percurso fica só neste aparelho."
              value={keepRoute}
              onChange={setKeepRoute}
            />
          </Card>
          <VoiceSection unit={unit} />
          <ShoesSection unit={unit} />
          <BackupSection canExport={workouts.length > 0} />

          <AccountSection />

          <Card gap={1} title={`PaceFlow ${Constants.expoConfig?.version ?? ''}`.trim()} icon="info">
            <Text className="text-base text-muted dark:text-muted-dark">
              Seus treinos ficam neste aparelho e o app funciona sem conta. A nuvem é opcional; o Backup acima
              exporta e restaura arquivos.
            </Text>
            <Button
              label="Política de privacidade"
              variant="link"
              accessibilityHint="Abre no navegador"
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            />
          </Card>
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
