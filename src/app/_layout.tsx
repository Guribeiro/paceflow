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
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Calculadora</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="timer" md="timer" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="diario">
          <NativeTabs.Trigger.Label>Diário</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="ajustes">
          <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
