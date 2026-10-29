import { View } from 'react-native';

interface Props {
  /** 0–1 (valores fora disso são limitados). */
  ratio: number;
  /** Dentro de um Card invertido: trilho e preenchimento com as cores trocadas. */
  inverted?: boolean;
}

/** Barra de progresso visual; o rótulo acessível fica no contêiner que a envolve. */
export function ProgressBar({ ratio, inverted = false }: Props) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%` as const;
  return (
    <View
      className={`h-3 overflow-hidden rounded-full ${inverted ? 'bg-neutral-600 dark:bg-neutral-300' : 'bg-neutral-300 dark:bg-neutral-700'}`}
    >
      <View
        style={{ width }}
        className={`h-full rounded-full ${inverted ? 'bg-white dark:bg-black' : 'bg-black dark:bg-white'}`}
      />
    </View>
  );
}
