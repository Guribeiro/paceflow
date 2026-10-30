import { render, screen, userEvent, within } from '@testing-library/react-native';

import appConfig from '../../../../app.json';
import { preferencesRepository } from '../../../data/preferences';
import { discardRunSession } from '../../../data/run-session';
import { RunScreen } from '../../../screens/RunScreen';
import { display, tabular } from '../typography';

// O tsconfig não carrega os tipos do Node; só este teste precisa do disco.
const { existsSync } = jest.requireActual<{ existsSync(path: string): boolean }>('fs');
const { dirname, resolve } = jest.requireActual<{
  dirname(path: string): string;
  resolve(...paths: string[]): string;
}>('path');
const ROOT = resolve(dirname(expect.getState().testPath ?? ''), '../../../..');

interface FontDefinition {
  path: string;
  weight: number;
}
interface FontPluginOptions {
  android?: { fonts?: { fontFamily: string; fontDefinitions: FontDefinition[] }[] };
}

/** Fontes que o plugin expo-font embute no Android (app.json). */
function embeddedAndroidFonts() {
  const plugins = appConfig.expo.plugins as unknown[];
  const plugin = plugins.find(
    (p): p is [string, FontPluginOptions] => Array.isArray(p) && p[0] === 'expo-font',
  );
  return plugin?.[1].android?.fonts ?? [];
}

describe('tipografia dos números de destaque', () => {
  it('display mantém os dígitos de largura fixa e usa a Inter', () => {
    expect(display).toEqual({ ...tabular, fontFamily: 'Inter' });
    expect(display.fontVariant).toEqual(['tabular-nums']);
  });

  it('a família usada no código é a mesma embutida no Android, com os pesos de font-semibold/bold/extrabold', () => {
    // Se o nome divergir, o Android cai em silêncio na fonte do sistema.
    const family = embeddedAndroidFonts().find((f) => f.fontFamily === display.fontFamily);
    expect(family?.fontDefinitions.map((d) => d.weight).sort()).toEqual([600, 700, 800]);
  });

  it('os arquivos .ttf apontados no app.json existem', () => {
    const paths = embeddedAndroidFonts().flatMap((f) => f.fontDefinitions.map((d) => d.path));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((p) => !existsSync(resolve(ROOT, p)))).toEqual([]);
  });
});

describe('Correr: cronômetro', () => {
  beforeEach(async () => {
    preferencesRepository.setUnit('km');
    await discardRunSession();
  });

  it('mostra o tempo da corrida em Inter com dígitos tabulares', async () => {
    const user = userEvent.setup();
    await render(<RunScreen />);
    await user.press(screen.getByRole('button', { name: 'Começar' }));

    const value = within(screen.getByLabelText(/^Tempo: /)).getByText(/\d/);
    expect(value).toHaveStyle({ fontFamily: 'Inter', fontVariant: ['tabular-nums'] });
  });
});
