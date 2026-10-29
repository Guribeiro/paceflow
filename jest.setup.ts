// O MMKV usa um mock em memória no Jest, mas importa o Nitro Modules no carregamento,
// que exige o módulo nativo. Este mock evita esse import em ambiente de teste.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      throw new Error('Nitro Modules não está disponível no Jest');
    },
  },
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// O mock do jest-expo para o expo-crypto devolve undefined em randomUUID;
// usa o crypto global do Node no lugar.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => globalThis.crypto.randomUUID(),
}));
