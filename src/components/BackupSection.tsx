import { useState } from 'react';
import { Text, View } from 'react-native';

import { exportWorkouts } from '../data/export/export-workouts';
import { type ImportOutcome, importWorkoutsFromFile } from '../data/import/import-workouts';
import type { ExportFormat } from '../domain/export';
import { useLargeText } from '../hooks/useLargeText';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

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

  const { summary, shoesAdded, invalid } = outcome;
  const parts = [
    summary.added > 0 && plural(summary.added, 'treino adicionado', 'treinos adicionados'),
    summary.updated > 0 && plural(summary.updated, 'treino atualizado', 'treinos atualizados'),
    shoesAdded > 0 && plural(shoesAdded, 'tênis adicionado', 'tênis adicionados'),
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
  const large = useLargeText();

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
    <Button
      key={action}
      label={busy === action ? 'Aguarde…' : label}
      variant="secondary"
      grow={!large}
      onPress={() => run(action)}
      disabled={busy !== null}
      busy={busy === action}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
    />
  );

  return (
    <Card gap={2} title="Backup" icon="backup">
      <View className={`${large ? 'flex-col' : 'flex-row'} gap-3`}>
        {canExport
          ? FORMATS.map(({ format, label, hint }) => button(format, label, `Exportar ${label}`, hint))
          : null}
        {button('import', 'Importar', 'Importar backup JSON', 'Mescla os treinos de um backup do PaceFlow')}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`text-base font-semibold ${
            message.isError ? 'text-red-700 dark:text-red-400' : 'text-ink dark:text-ink-dark'
          }`}
        >
          {message.text}
        </Text>
      ) : null}
    </Card>
  );
}
