import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from '../../app.json';
import appConfig, { withVariant } from '../../app.config';

const base = appJson.expo as unknown as ExpoConfig;

type WidgetsOptions = { enableAndroid?: boolean; widgets: { displayName: string }[] };

const widgetsPlugin = (config: ExpoConfig) =>
  config.plugins?.find((p) => Array.isArray(p) && p[0] === 'expo-widgets') as [string, WidgetsOptions] | undefined;

const widgetName = (config: ExpoConfig) => widgetsPlugin(config)?.[1].widgets[0].displayName;

describe('variantes do app', () => {
  it('sem APP_VARIANT é o app de uso diário, igual ao app.json', () => {
    expect(withVariant(base, undefined)).toEqual(base);
    expect(withVariant(base, 'production')).toEqual(base);
  });

  it('development ganha outro pacote, nome, scheme e nome de widget', () => {
    const dev = withVariant(base, 'development');
    expect(dev.android?.package).toBe('com.gustavoribeiro.paceflow.dev');
    expect(dev.name).toBe('PaceFlow Dev');
    expect(dev.scheme).toBe('paceflow-dev');
    expect(widgetName(dev)).toBe('PaceFlow Dev — Semana');
  });

  it('development mantém o resto da configuração', () => {
    const dev = withVariant(base, 'development');
    expect(dev.slug).toBe(base.slug);
    expect(dev.android?.adaptiveIcon).toEqual(base.android?.adaptiveIcon);
    expect(dev.plugins).toHaveLength(base.plugins?.length ?? 0);
    expect(widgetName(base)).toBe('PaceFlow — Semana');
  });

  it('development só troca o displayName do widget e não mexe nos outros plugins', () => {
    const dev = withVariant(base, 'development');
    const [, baseOptions] = widgetsPlugin(base)!;
    const [, devOptions] = widgetsPlugin(dev)!;
    expect(devOptions).toEqual({
      ...baseOptions,
      widgets: baseOptions.widgets.map((w) => ({ ...w, displayName: 'PaceFlow Dev — Semana' })),
    });
    const others = (config: ExpoConfig) =>
      config.plugins?.filter((p) => !(Array.isArray(p) && p[0] === 'expo-widgets'));
    expect(others(dev)).toEqual(others(base));
  });

  it('não altera a configuração recebida (função pura)', () => {
    const before = structuredClone(base);
    withVariant(base, 'development');
    expect(base).toEqual(before);
  });
});

describe('permissões do Android', () => {
  const blocked = [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ];

  it('bloqueia as permissões que o app não usa (sobreposição e armazenamento externo)', () => {
    expect([...(base.android?.blockedPermissions ?? [])].sort()).toEqual([...blocked].sort());
  });

  it('a variante development mantém o bloqueio', () => {
    expect(withVariant(base, 'development').android?.blockedPermissions).toEqual(base.android?.blockedPermissions);
  });

  it('nenhuma permissão bloqueada é pedida em android.permissions', () => {
    const requested = base.android?.permissions ?? [];
    expect(requested.filter((p) => blocked.includes(p))).toEqual([]);
  });
});

describe('default export', () => {
  const original = process.env.APP_VARIANT;
  const context = { config: base } as unknown as ConfigContext;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = original;
  });

  it('usa a variante development quando APP_VARIANT=development', () => {
    process.env.APP_VARIANT = 'development';
    expect(appConfig(context)).toEqual(withVariant(base, 'development'));
  });

  it('sem APP_VARIANT devolve a configuração do app.json', () => {
    delete process.env.APP_VARIANT;
    expect(appConfig(context)).toEqual(base);
  });
});
