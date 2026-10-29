import '../../global.css';
import { NativeTabs } from 'expo-router/native-tabs';
import { StatusBar } from 'expo-status-bar';

import { useApplyTheme } from '../hooks/useApplyTheme';
import { useAutoSync } from '../hooks/useAutoSync';
import { useWidgetSync } from '../hooks/useWidgetSync';

export default function RootLayout() {
  useApplyTheme();
  useWidgetSync();
  useAutoSync();

  return (
    <>
      {/* "auto" segue o colorScheme do app (ícones escuros no tema claro e vice-versa). */}
      <StatusBar style="auto" />
      {/* Com 4 abas o Material 3 esconde os rótulos das não selecionadas; sempre visíveis é mais claro. */}
      <NativeTabs labelVisibilityMode="labeled">
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Calculadora</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="timer" md="timer" />
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
