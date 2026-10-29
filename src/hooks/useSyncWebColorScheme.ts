import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

/**
 * Na web, com darkMode 'class', o NativeWind só aplica `dark:` quando o <html>
 * tem a classe "dark". Este hook mantém essa classe igual ao tema do sistema.
 * No nativo o NativeWind já segue o sistema, então não faz nada.
 */
export function useSyncWebColorScheme() {
  const scheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    colorScheme.set(scheme === 'dark' ? 'dark' : 'light');
  }, [scheme]);
}
