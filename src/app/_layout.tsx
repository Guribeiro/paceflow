import '../../global.css';
import { NativeTabs } from 'expo-router/native-tabs';
import { StatusBar } from 'expo-status-bar';

import { usePalette } from '../components/ui/palette';
import { useApplyTheme } from '../hooks/useApplyTheme';
import { useAutoSync } from '../hooks/useAutoSync';
import { useReminderSync } from '../hooks/useReminderSync';
import { useRunRecovery } from '../hooks/useRunRecovery';
import { applyStoredTheme } from '../hooks/useThemePreference';
import { useWidgetSync } from '../hooks/useWidgetSync';

applyStoredTheme();

/**
 * Isolado num componente próprio: assim a mudança da preferência de tema não
 * re-renderiza o layout (e com ele todas as abas) antes de a troca começar.
 */
function ThemeSync() {
  useApplyTheme();
  return null;
}

export default function RootLayout() {
  useWidgetSync();
  useAutoSync();
  useReminderSync();
  useRunRecovery();
  // Cores do app em vez do roxo padrão do Material 3: aba ativa em laranja sobre
  // o indicador laranja-claro, demais em cinza de texto secundário.
  const palette = usePalette();

  return (
    <>
      <ThemeSync />
      {/* "auto" segue o colorScheme do app (ícones escuros no tema claro e vice-versa). */}
      <StatusBar style="auto" />
      {/* Com 4+ abas o Material 3 esconde os rótulos das não selecionadas; sempre visíveis é mais claro. */}
      <NativeTabs
        labelVisibilityMode="labeled"
        backgroundColor={palette.surface}
        indicatorColor={palette.brandSoft}
        rippleColor={palette.surface2}
        iconColor={{ default: palette.muted, selected: palette.brandInk }}
        labelStyle={{ default: { color: palette.muted }, selected: { color: palette.brandInk, fontWeight: 'bold' } }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Calculadora</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="timer" md="timer" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="correr">
          <NativeTabs.Trigger.Label>Correr</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="figure.run" md="directions_run" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="diario">
          <NativeTabs.Trigger.Label>Diário</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="evolucao">
          <NativeTabs.Trigger.Label>Evolução</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ajustes">
          <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
