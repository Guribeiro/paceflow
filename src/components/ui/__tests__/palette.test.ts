import { ON_BRAND, PALETTE } from '../palette';

// O tailwind.config.js é CommonJS; o require traz as mesmas cores que o NativeWind usa.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../../../tailwind.config') as {
  theme: { extend: { colors: Record<string, { DEFAULT: string; dark: string }> } };
};

/** Luminância relativa WCAG 2.x de um hex #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;

describe.each(['light', 'dark'] as const)('paleta %s', (theme) => {
  const p = PALETTE[theme];

  it.each([
    ['ink sobre canvas', p.ink, p.canvas],
    ['ink sobre surface', p.ink, p.surface],
    ['ink sobre surface-2 (chip, botão secundário)', p.ink, p.surface2],
    ['muted sobre canvas', p.muted, p.canvas],
    ['muted sobre surface', p.muted, p.surface],
    ['muted sobre surface-2', p.muted, p.surface2],
    ['branco sobre brand (hero, botão primário)', ON_BRAND, p.brand],
    ['brand-ink sobre canvas (link)', p.brandInk, p.canvas],
    ['brand-ink sobre surface', p.brandInk, p.surface],
    ['brand-ink sobre brand-soft (aba ativa)', p.brandInk, p.brandSoft],
    ['muted sobre surface (aba inativa)', p.muted, p.surface],
    ['placeholder sobre surface (campo)', p.placeholder, p.surface],
    ['danger sobre surface', p.danger, p.surface],
  ])('texto: %s ≥ 4,5:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each([
    ['barra não selecionada sobre canvas', p.bar, p.canvas],
    ['barra não selecionada sobre surface', p.bar, p.surface],
    ['barra selecionada sobre canvas', p.brandInk, p.canvas],
    ['contorno do campo sobre canvas', p.bar, p.canvas],
  ])('gráfico: %s ≥ 3:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(GRAPHIC);
  });
});

describe('tailwind.config.js', () => {
  const colors = tailwindConfig.theme.extend.colors;
  const tokens: [string, keyof (typeof PALETTE)['light']][] = [
    ['canvas', 'canvas'],
    ['surface', 'surface'],
    ['surface-2', 'surface2'],
    ['ink', 'ink'],
    ['muted', 'muted'],
    ['bar', 'bar'],
    ['brand', 'brand'],
    ['brand-ink', 'brandInk'],
    ['brand-soft', 'brandSoft'],
  ];

  it.each(tokens)('%s tem os mesmos hex de palette.ts', (className, key) => {
    expect(colors[className]).toEqual({ DEFAULT: PALETTE.light[key], dark: PALETTE.dark[key] });
  });
});
