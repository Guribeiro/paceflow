import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Instância própria para a sessão, separada dos treinos. Ao sair da conta, só
// ela é limpa. (A documentação do Expo usa expo-sqlite; o MMKV evita outro
// módulo nativo e outro lugar de armazenamento.)
const authStorage = createMMKV({ id: 'paceflow-auth' });

/** null quando o app foi gerado sem as variáveis do Supabase: o sync fica desativado. */
export const supabase: SupabaseClient<Database> | null =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, {
        auth: {
          storage: {
            getItem: (key) => authStorage.getString(key) ?? null,
            setItem: (key, value) => authStorage.set(key, value),
            removeItem: (key) => {
              authStorage.remove(key);
            },
          },
          autoRefreshToken: true,
          persistSession: true,
          // Não há URL para ler sessão no app: o login é por código.
          detectSessionInUrl: false,
        },
      })
    : null;

// No nativo, o refresh do token roda em loop; só faz sentido com o app aberto.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
