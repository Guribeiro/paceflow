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

// Notificações locais em memória: os testes conferem o que ficou agendado
// pelo próprio getAllScheduledNotificationsAsync.
jest.mock('expo-notifications', () => {
  const scheduled = new Map<string, { identifier: string; content: unknown; trigger: unknown }>();
  return {
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' })),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([...scheduled.values()])),
    scheduleNotificationAsync: jest.fn(
      (request: { identifier: string; content: unknown; trigger: unknown }) => {
        scheduled.set(request.identifier, request);
        return Promise.resolve(request.identifier);
      },
    ),
    cancelScheduledNotificationAsync: jest.fn((identifier: string) => {
      scheduled.delete(identifier);
      return Promise.resolve();
    }),
  };
});

// Tarefas definidas ficam guardadas: os testes chamam `__runTask(nome, corpo)`
// para simular localizações chegando do serviço do Android.
type MockTaskExecutor = (body: unknown) => unknown;
jest.mock('expo-task-manager', () => {
  const tasks = new Map<string, MockTaskExecutor>();
  return {
    defineTask: jest.fn((name: string, executor: MockTaskExecutor) => tasks.set(name, executor)),
    isTaskDefined: (name: string) => tasks.has(name),
    __runTask: (name: string, body: unknown) => tasks.get(name)?.(body),
  };
});

// GPS com permissão concedida e serviço ligado/desligado em memória.
jest.mock('expo-location', () => {
  const started = new Set<string>();
  return {
    Accuracy: { BestForNavigation: 6 },
    requestForegroundPermissionsAsync: jest.fn(() =>
      Promise.resolve({ granted: true, canAskAgain: true, status: 'granted' }),
    ),
    hasServicesEnabledAsync: jest.fn(() => Promise.resolve(true)),
    startLocationUpdatesAsync: jest.fn((name: string) => {
      started.add(name);
      return Promise.resolve();
    }),
    stopLocationUpdatesAsync: jest.fn((name: string) => {
      started.delete(name);
      return Promise.resolve();
    }),
    hasStartedLocationUpdatesAsync: jest.fn((name: string) => Promise.resolve(started.has(name))),
  };
});
