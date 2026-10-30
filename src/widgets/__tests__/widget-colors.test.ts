import appConfig from '../../../app.json';
import { ON_BRAND, PALETTE } from '../../components/ui/palette';

// O widget e a notificação da corrida rodam num runtime isolado e não podem
// importar a paleta; o splash é configurado no app.json. Este teste lê os dois
// como texto/JSON e confere que os hex continuam os mesmos de palette.ts.
const { readFileSync } = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const { dirname, resolve } = jest.requireActual<{
  dirname(path: string): string;
  resolve(...paths: string[]): string;
}>('path');

type PaletteKey = keyof typeof PALETTE.light;
const DECLARATION = /const (\w+) = dark \? '(#[0-9A-Fa-f]{6})' : '(#[0-9A-Fa-f]{6})'/g;

/**
 * Lê o arquivo do runtime isolado e mapeia cada `const nome = dark ? '#escuro' :
 * '#claro'` para a chave da paleta, para conferir onde cada cor é usada (não
 * basta o par existir no arquivo).
 */
function readWidget(file: string) {
  const source = readFileSync(resolve(dirname(expect.getState().testPath ?? ''), '..', file), 'utf8');
  const colorVars = new Map<string, PaletteKey>();
  for (const [, name, darkHex, lightHex] of source.matchAll(DECLARATION)) {
    const key = (Object.keys(PALETTE.light) as PaletteKey[]).find(
      (k) => PALETTE.dark[k] === darkHex && PALETTE.light[k] === lightHex,
    );
    if (key) colorVars.set(name, key);
  }
  /** Chave da paleta da cor usada no primeiro grupo do padrão. */
  const keyOf = (pattern: RegExp) => {
    const name = source.match(pattern)?.[1];
    return name === undefined ? undefined : colorVars.get(name);
  };
  return { source, colorVars, keyOf };
}

describe('cores do widget', () => {
  const { source: widgetSource, colorVars, keyOf } = readWidget('WeekWidget.tsx');

  it.each(['surface', 'bar', 'ink', 'muted', 'brandInk'] as const)('usa %s da paleta nos dois temas', (key) => {
    const pair = `dark ? '${PALETTE.dark[key]}' : '${PALETTE.light[key]}'`;
    expect(widgetSource).toContain(pair);
  });

  it('não tem hex fora das cores declaradas a partir da paleta', () => {
    const hexes = widgetSource.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    expect(hexes).toHaveLength(colorVars.size * 2);
  });

  it('pinta o fundo do widget com surface', () => {
    expect(keyOf(/background\((\w+)\)/)).toBe('surface');
  });

  it('pinta o rótulo da semana com brandInk', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{props\.weekLabel\}/)).toBe('brandInk');
  });

  it('pinta a distância com ink', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{`\$\{props\.distance\}/)).toBe('ink');
  });

  it('pinta o último pace com muted', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{props\.lastPace/)).toBe('muted');
  });

  it('pinta os blocos da meta com brandInk (feitos) e bar (faltando)', () => {
    // Barra em blocos de fundo: o LinearProgressIndicator ignora a cor no Android 11.
    expect(widgetSource).not.toContain('<LinearProgressIndicator');
    const fill = widgetSource.match(/background\(i < filled \? (\w+) : (\w+)\)/);
    expect([colorVars.get(fill?.[1] ?? ''), colorVars.get(fill?.[2] ?? '')]).toEqual(['brandInk', 'bar']);
  });
});

describe('cores da notificação da corrida', () => {
  const { source, colorVars, keyOf } = readWidget('RunNotification.tsx');

  it('declara cada cor a partir de um par da paleta', () => {
    const names = [...source.matchAll(DECLARATION)].map(([, name]) => name);
    expect(new Set(names)).toEqual(new Set(colorVars.keys()));
    expect(Object.fromEntries(colorVars)).toEqual({ fg: 'ink', muted: 'muted', bar: 'bar', accent: 'brandInk' });
  });

  it('fora da paleta, só usa o branco sobre a marca (texto do botão)', () => {
    const rest = source.replace(DECLARATION, '');
    expect(rest.match(/#[0-9A-Fa-f]{3,8}\b/g)).toEqual([ON_BRAND, ON_BRAND]);
  });

  it('pinta o estado da corrida com brandInk', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{status\}/)).toBe('brandInk');
  });

  it('pinta o tempo com ink e o pace com muted', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{props\.time\}/)).toBe('ink');
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{pace\}/)).toBe('muted');
  });

  it('pinta a parcial em andamento com muted', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{props\.lastSplit/)).toBe('muted');
  });

  it('pinta os blocos da parcial com brandInk (feitos) e bar (faltando)', () => {
    const fill = source.match(/background\(i < filled \? (\w+) : (\w+)\)/);
    expect([colorVars.get(fill?.[1] ?? ''), colorVars.get(fill?.[2] ?? '')]).toEqual(['brandInk', 'bar']);
  });

  it('pinta o botão Pausar com brandInk e texto branco', () => {
    const button = source.match(/containerColor: (\w+), contentColor: '(#[0-9A-Fa-f]{6})'/);
    expect(colorVars.get(button?.[1] ?? '')).toBe('brandInk');
    expect(button?.[2]).toBe(ON_BRAND);
  });

  it('pinta o resumo com brandInk no título, ink na distância e muted no pace médio', () => {
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*Corrida finalizada/)).toBe('brandInk');
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{`\$\{props\.distance\}/)).toBe('ink');
    expect(keyOf(/<Text color=\{(\w+)\}[^>]*>\s*\{`Pace médio/)).toBe('muted');
  });
});

describe('splash', () => {
  const plugin = (appConfig.expo.plugins as unknown[]).find(
    (p): p is [string, { backgroundColor: string; dark: { backgroundColor: string } }] =>
      Array.isArray(p) && p[0] === 'expo-splash-screen',
  );

  it('usa o fundo das telas (canvas) nos dois temas', () => {
    expect(plugin?.[1].backgroundColor).toBe(PALETTE.light.canvas);
    expect(plugin?.[1].dark.backgroundColor).toBe(PALETTE.dark.canvas);
  });
});
