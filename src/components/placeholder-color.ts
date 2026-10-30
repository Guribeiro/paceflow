import { usePalette } from './ui/palette';

// Contraste ≥ 4,5:1 (AA) sobre o fundo do campo nos dois temas (palette.test.ts).
export function usePlaceholderColor(): string {
  return usePalette().placeholder;
}
