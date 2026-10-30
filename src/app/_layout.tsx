import '../../global.css';
import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';

import { useApplyTheme } from '../hooks/useApplyTheme';
import { useAutoSync } from '../hooks/useAutoSync';
import { useReminderSync } from '../hooks/useReminderSync';
import { useRunRecovery } from '../hooks/useRunRecovery';
import { useWidgetSync } from '../hooks/useWidgetSync';

export default function RootLayout() {
  useApplyTheme();
  useWidgetSync();
  useAutoSync();
  useReminderSync();
  useRunRecovery();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  // Cores do tema em vez do roxo padrão do Material 3: indicador invertido e
  // rótulos de alto contraste, como o resto do app.
  const ink = dark ? '#ffffff' : '#000000';
  const paper = dark ? '#000000' : '#ffffff';
  const muted = dark ? '#d4d4d4' : '#404040';

  return (
    <>
      {/* "auto" segue o colorScheme do app (ícones escuros no tema claro e vice-versa). */}
      <StatusBar style="auto" />
      {/* Com 4+ abas o Material 3 esconde os rótulos das não selecionadas; sempre visíveis é mais claro. */}
      <NativeTabs
        labelVisibilityMode="labeled"
        backgroundColor={paper}
        indicatorColor={ink}
        rippleColor={muted}
        iconColor={{ default: muted, selected: paper }}
        labelStyle={{ default: { color: muted }, selected: { color: ink, fontWeight: 'bold' } }}
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
