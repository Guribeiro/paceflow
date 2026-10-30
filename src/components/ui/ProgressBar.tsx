import { View } from 'react-native';

interface Props {
  /** 0–1 (valores fora disso são limitados). */
  ratio: number;
  /** Dentro de um Card hero: trilho escurecido e preenchimento branco. */
  inverted?: boolean;
}

/** Barra de progresso visual; o rótulo acessível fica no contêiner que a envolve. */
export function ProgressBar({ ratio, inverted = false }: Props) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%` as const;
  return (
    <View
      className={`h-3 overflow-hidden rounded-full ${inverted ? 'bg-black/30' : 'bg-surface-2 dark:bg-surface-2-dark'}`}
    >
      <View
        style={{ width }}
        className={`h-full rounded-full ${inverted ? 'bg-white' : 'bg-brand-ink dark:bg-brand-ink-dark'}`}
      />
    </View>
  );
}
