// O MMKV usa um mock em memória no Jest, mas importa o Nitro Modules no carregamento,
// que exige o módulo nativo. Este mock evita esse import em ambiente de teste.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => {
      throw new Error('Nitro Modules não está disponível no Jest');
    },
  },
}));
