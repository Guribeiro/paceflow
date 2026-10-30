import appConfig from '../../../app.json';
import { PALETTE } from '../../components/ui/palette';

// O widget roda num runtime isolado e não pode importar a paleta; o splash é
// configurado no app.json. Este teste lê os dois como texto/JSON e confere que
// os hex continuam os mesmos de palette.ts.
const { readFileSync } = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const { dirname, resolve } = jest.requireActual<{
  dirname(path: string): string;
  resolve(...paths: string[]): string;
}>('path');
const widgetSource = readFileSync(resolve(dirname(expect.getState().testPath ?? ''), '../WeekWidget.tsx'), 'utf8');

describe('cores do widget', () => {
  it.each(['surface', 'surface2', 'ink', 'muted', 'brandInk'] as const)('usa %s da paleta nos dois temas', (key) => {
    const pair = `dark ? '${PALETTE.dark[key]}' : '${PALETTE.light[key]}'`;
    expect(widgetSource).toContain(pair);
  });

  // Mapeia cada `const nome = dark ? '#escuro' : '#claro'` para a chave da paleta,
  // para conferir onde cada cor é usada (não basta o par existir no arquivo).
  const colorVars = new Map<string, keyof typeof PALETTE.light>();
  for (const [, name, darkHex, lightHex] of widgetSource.matchAll(
    /const (\w+) = dark \? '(#[0-9A-Fa-f]{6})' : '(#[0-9A-Fa-f]{6})'/g,
  )) {
    const key = (Object.keys(PALETTE.light) as (keyof typeof PALETTE.light)[]).find(
      (k) => PALETTE.dark[k] === darkHex && PALETTE.light[k] === lightHex,
    );
    if (key) colorVars.set(name, key);
  }
  const keyOf = (pattern: RegExp) => {
    const name = widgetSource.match(pattern)?.[1];
    return name === undefined ? undefined : colorVars.get(name);
  };

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

  it('usa brandInk na barra de progresso e surface2 no trilho', () => {
    const bar = widgetSource.match(/<LinearProgressIndicator[\s\S]*?\/>/)?.[0] ?? '';
    expect({
      color: colorVars.get(bar.match(/\scolor=\{(\w+)\}/)?.[1] ?? ''),
      trackColor: colorVars.get(bar.match(/trackColor=\{(\w+)\}/)?.[1] ?? ''),
    }).toEqual({ color: 'brandInk', trackColor: 'surface2' });
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
