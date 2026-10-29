import { createMMKV } from 'react-native-mmkv';

// Instância única de armazenamento local. Repositórios devem usar esta
// instância em vez de criar a própria.
export const storage = createMMKV({ id: 'paceflow' });
