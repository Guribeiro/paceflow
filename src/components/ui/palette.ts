import { useColorScheme } from 'nativewind';

/**
 * Cores do app, iguais às do tailwind.config.js (palette.test.ts confere). Use as
 * classes (`bg-surface dark:bg-surface-dark`) nas views; este objeto é para o
 * que só aceita cor em JS: abas nativas, ActivityIndicator, ícones, widget.
 *
 * Contraste conferido em palette.test.ts: texto ≥ 4,5:1, barras e ícones ≥ 3:1.
 */
export const PALETTE = {
  light: {
    canvas: '#F4F4F5',
    surface: '#FFFFFF',
    surface2: '#E9E9EC',
    ink: '#111111',
    muted: '#4A4A4F',
    /** Barras não selecionadas do gráfico. */
    bar: '#8A8A90',
    brand: '#D1440C',
    brandInk: '#B33A0A',
    brandSoft: '#FFE8DD',
    danger: '#b91c1c',
    placeholder: '#737373',
  },
  dark: {
    canvas: '#0B0B0C',
    surface: '#1A1A1D',
    surface2: '#26262A',
    ink: '#FFFFFF',
    muted: '#C8C8CC',
    bar: '#6E6E75',
    brand: '#D1440C',
    brandInk: '#FF7A3D',
    brandSoft: '#3A1A0C',
    danger: '#f87171',
    placeholder: '#8f8f8f',
  },
} as const;

/** Texto sobre `brand` (hero, botão primário): branco nos dois temas. */
export const ON_BRAND = '#FFFFFF';

export type Palette = (typeof PALETTE)[keyof typeof PALETTE];

export function usePalette(): Palette {
  const { colorScheme } = useColorScheme();
  return PALETTE[colorScheme === 'dark' ? 'dark' : 'light'];
}
