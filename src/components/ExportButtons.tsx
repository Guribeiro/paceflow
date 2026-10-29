import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { exportWorkouts } from '../data/export/export-workouts';
import type { ExportFormat } from '../domain/export';

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'csv', label: 'CSV', hint: 'Para abrir no Excel ou no Google Planilhas' },
  { format: 'json', label: 'JSON', hint: 'Backup completo ou análise por código' },
];

export function ExportButtons() {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(format: ExportFormat) {
    setBusy(format);
    setFailed(false);
    try {
      await exportWorkouts(format);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Exportar treinos</Text>
      <View className="flex-row gap-3">
        {FORMATS.map(({ format, label, hint }) => (
          <Pressable
            key={format}
            onPress={() => run(format)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`Exportar ${label}`}
            accessibilityHint={hint}
            accessibilityState={{ disabled: busy !== null, busy: busy === format }}
            className="min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-black dark:border-white"
          >
            <Text className="text-lg font-bold text-black dark:text-white">
              {busy === format ? 'Gerando…' : label}
            </Text>
          </Pressable>
        ))}
      </View>
      {failed ? (
        <Text accessibilityLiveRegion="polite" className="text-base font-semibold text-red-700 dark:text-red-400">
          Não foi possível exportar. Tente de novo.
        </Text>
      ) : null}
    </View>
  );
}
