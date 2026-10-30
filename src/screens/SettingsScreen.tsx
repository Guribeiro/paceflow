import Constants from 'expo-constants';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAware } from '../components/KeyboardAware';
import { RemindersSection } from '../components/RemindersSection';
import { AccountSection } from '../components/AccountSection';
import { BackupSection } from '../components/BackupSection';
import { ChoiceChips } from '../components/ChoiceChips';
import { ShoesSection } from '../components/ShoesSection';
import { WeeklyGoalSetting } from '../components/WeeklyGoalSetting';
import type { ThemePreference } from '../data/repositories/preferences-repository';
import type { DistanceUnit } from '../domain/pace';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useThemePreference } from '../hooks/useThemePreference';
import { useWorkouts } from '../hooks/useWorkouts';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';

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
          <ShoesSection unit={unit} />
          <BackupSection canExport={workouts.length > 0} />

          <AccountSection />

          <Card gap={1} title={`PaceFlow ${Constants.expoConfig?.version ?? ''}`.trim()} icon="info">
            <Text className="text-base text-muted dark:text-muted-dark">
              Seus treinos ficam neste aparelho e o app funciona sem conta. A nuvem é opcional; o Backup acima
              exporta e restaura arquivos.
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}
