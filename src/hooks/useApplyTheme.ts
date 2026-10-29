import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useThemePreference } from './useThemePreference';

/**
 * Aplica a preferência de tema salva.
 *
 * No nativo, colorScheme.set repassa para Appearance.setColorScheme, então a
 * barra de status e as abas nativas acompanham; "system" volta a seguir o SO.
 * Na web, com darkMode 'class', o NativeWind só aplica `dark:` quando o <html>
 * tem a classe "dark", e set('system') removeria a classe; por isso resolve
 * "system" pelo tema do navegador e passa sempre 'light' ou 'dark'.
 */
export function useApplyTheme() {
  const [theme] = useThemePreference();
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      colorScheme.set(theme);
      return;
    }
    const resolved = theme === 'system' ? systemScheme : theme;
    colorScheme.set(resolved === 'dark' ? 'dark' : 'light');
  }, [theme, systemScheme]);
}
