import '../../global.css';
import { NativeTabs } from 'expo-router/native-tabs';

import { useSyncWebColorScheme } from '../hooks/useSyncWebColorScheme';

export default function RootLayout() {
  useSyncWebColorScheme();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Calculadora</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="timer" md="timer" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="diario">
        <NativeTabs.Trigger.Label>Diário</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
