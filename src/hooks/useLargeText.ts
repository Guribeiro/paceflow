import { useWindowDimensions } from 'react-native';

/** Acima desta escala de fonte do sistema, layouts lado a lado passam a empilhar. */
export const LARGE_TEXT_SCALE = 1.3;

/** Teto para os números gigantes: crescem com a fonte do sistema sem estourar a tela. */
export const BIG_NUMBER_MAX_SCALE = 1.6;

export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}
