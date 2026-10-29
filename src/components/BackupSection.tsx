import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { exportWorkouts } from '../data/export/export-workouts';
import { type ImportOutcome, importWorkoutsFromFile } from '../data/import/import-workouts';
import type { ExportFormat } from '../domain/export';

type Action = ExportFormat | 'import';

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'csv', label: 'CSV', hint: 'Para abrir no Excel ou no Google Planilhas' },
  { format: 'json', label: 'JSON', hint: 'Backup completo, que pode ser importado de volta' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describeImport(outcome: Exclude<ImportOutcome, { status: 'canceled' }>): { text: string; isError: boolean } {
  if (outcome.status === 'error') {
    return {
      isError: true,
      text:
        outcome.error === 'INVALID_JSON'
          ? 'O arquivo não é um JSON válido.'
          : 'Este arquivo não é um backup do PaceFlow.',
    };
  }

  const { summary, invalid } = outcome;
  const parts = [
    summary.added > 0 && plural(summary.added, 'treino adicionado', 'treinos adicionados'),
    summary.updated > 0 && plural(summary.updated, 'treino atualizado', 'treinos atualizados'),
  ].filter((p): p is string => Boolean(p));

  let text = parts.length > 0 ? `${parts.join(', ')}.` : 'Nenhum treino novo: o diário já estava atualizado.';
  if (invalid > 0) text += ` ${plural(invalid, 'registro inválido ignorado', 'registros inválidos ignorados')}.`;
  return { text, isError: false };
}

interface Props {
  canExport: boolean;
}

export function BackupSection({ canExport }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'import') {
        const outcome = await importWorkoutsFromFile();
        if (outcome.status !== 'canceled') setMessage(describeImport(outcome));
      } else {
        await exportWorkouts(action);
      }
    } catch {
      setMessage({
        isError: true,
        text: action === 'import' ? 'Não foi possível importar. Tente de novo.' : 'Não foi possível exportar. Tente de novo.',
      });
    } finally {
      setBusy(null);
    }
  }

  const button = (action: Action, label: string, accessibilityLabel: string, hint: string) => (
    <Pressable
      key={action}
      onPress={() => run(action)}
      disabled={busy !== null}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      accessibilityState={{ disabled: busy !== null, busy: busy === action }}
      className="min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-black dark:border-white"
    >
      <Text className="text-lg font-bold text-black dark:text-white">{busy === action ? 'Aguarde…' : label}</Text>
    </Pressable>
  );

  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-200">Backup</Text>
      <View className="flex-row gap-3">
        {canExport
          ? FORMATS.map(({ format, label, hint }) => button(format, label, `Exportar ${label}`, hint))
          : null}
        {button('import', 'Importar', 'Importar backup JSON', 'Mescla os treinos de um backup do PaceFlow')}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`text-base font-semibold ${
            message.isError ? 'text-red-700 dark:text-red-400' : 'text-black dark:text-white'
          }`}
        >
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}
