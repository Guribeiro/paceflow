import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * O app.json é a configuração base (os testes leem dele). Este arquivo só muda o
 * que separa as duas instalações no mesmo aparelho:
 * - sem APP_VARIANT: "PaceFlow", o app de uso diário (build de release);
 * - APP_VARIANT=development: "PaceFlow Dev", com outro pacote, para o build de
 *   desenvolvimento conviver com o de uso diário, cada um com seus dados.
 */
type WidgetsPlugin = [string, { widgets?: { displayName?: string }[] }];

export function withVariant(config: ExpoConfig, variant: string | undefined): ExpoConfig {
  if (variant !== 'development') return config;

  const plugins = config.plugins?.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-widgets') return plugin;
    const [name, options] = plugin as WidgetsPlugin;
    return [
      name,
      {
        ...options,
        widgets: options.widgets?.map((w) => ({ ...w, displayName: w.displayName?.replace('PaceFlow', 'PaceFlow Dev') })),
      },
    ] as WidgetsPlugin;
  });

  return {
    ...config,
    name: 'PaceFlow Dev',
    scheme: 'paceflow-dev',
    android: { ...config.android, package: `${config.android?.package}.dev` },
    plugins,
  };
}

export default ({ config }: ConfigContext): ExpoConfig => withVariant(config as ExpoConfig, process.env.APP_VARIANT);
