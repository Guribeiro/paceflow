import Constants from 'expo-constants';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '../components/AccountSection';
import { ChoiceChips } from '../components/ChoiceChips';
import type { ThemePreference } from '../data/repositories/preferences-repository';
import type { DistanceUnit } from '../domain/pace';
import { usePreferredUnit } from '../hooks/usePreferredUnit';
import { useThemePreference } from '../hooks/useThemePreference';

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

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerClassName="gap-6 p-4">
        <Text className="text-3xl font-bold text-black dark:text-white" accessibilityRole="header">
          Ajustes
        </Text>

        {/* Seleção obrigatória: tocar na opção ativa não desmarca. */}
        <ChoiceChips label="Tema" options={THEME_OPTIONS} value={theme} onChange={(v) => v && setTheme(v)} />
        <ChoiceChips label="Unidade" options={UNIT_OPTIONS} value={unit} onChange={(v) => v && setUnit(v)} />

        <AccountSection />

        <View className="gap-1 rounded-xl border-2 border-black p-4 dark:border-white">
          <Text className="text-lg font-bold text-black dark:text-white">PaceFlow {Constants.expoConfig?.version}</Text>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            Seus treinos ficam neste aparelho e o app funciona sem conta. A nuvem é opcional; o Backup no Diário
            exporta e restaura arquivos.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
