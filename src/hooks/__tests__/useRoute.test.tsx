import { act, renderHook } from '@testing-library/react-native';

import { routeRepository } from '../../data/routes';
import type { Route } from '../../domain/route';
import { useHasRoute, useRoute } from '../useRoute';

const route: Route = [
  [
    [-23.55, -46.63],
    [-23.551, -46.631],
  ],
];
const other: Route = [[[-22.9, -43.2]]];

// O routeRepository real usa o MMKV em memória compartilhado no arquivo: cada teste limpa os ids que usa.
const ids = ['w1', 'w2'];
beforeEach(() => ids.forEach((id) => routeRepository.remove(id)));
afterEach(() => {
  jest.restoreAllMocks();
  ids.forEach((id) => routeRepository.remove(id));
});

describe('useHasRoute', () => {
  it('começa falso sem trajeto e verdadeiro com trajeto salvo', async () => {
    routeRepository.set('w2', route);
    const { result: without } = await renderHook(() => useHasRoute('w1'));
    const { result: withRoute } = await renderHook(() => useHasRoute('w2'));
    expect(without.current).toBe(false);
    expect(withRoute.current).toBe(true);
  });

  it('atualiza ao gravar, apagar e importar o trajeto', async () => {
    const { result } = await renderHook(() => useHasRoute('w1'));

    await act(async () => routeRepository.set('w1', route));
    expect(result.current).toBe(true);

    await act(async () => routeRepository.remove('w1'));
    expect(result.current).toBe(false);

    await act(async () => {
      routeRepository.importRoutes({ w1: route });
    });
    expect(result.current).toBe(true);
  });

  it('acompanha a troca de id', async () => {
    routeRepository.set('w1', route);
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useHasRoute(id), { initialProps: { id: 'w1' } });
    expect(result.current).toBe(true);

    await rerender({ id: 'w2' });
    expect(result.current).toBe(false);
  });
});

describe('useRoute', () => {
  it('começa null sem trajeto e com o trajeto salvo quando há', async () => {
    routeRepository.set('w2', route);
    const { result: without } = await renderHook(() => useRoute('w1'));
    const { result: withRoute } = await renderHook(() => useRoute('w2'));
    expect(without.current).toBeNull();
    expect(withRoute.current).toEqual(route);
  });

  it('atualiza ao gravar, trocar, apagar e importar o trajeto', async () => {
    const { result } = await renderHook(() => useRoute('w1'));

    await act(async () => routeRepository.set('w1', route));
    expect(result.current).toEqual(route);

    await act(async () => routeRepository.set('w1', other));
    expect(result.current).toEqual(other);

    await act(async () => routeRepository.remove('w1'));
    expect(result.current).toBeNull();

    await act(async () => {
      routeRepository.importRoutes({ w1: route });
    });
    expect(result.current).toEqual(route);
  });

  it('mantém a mesma referência entre renders sem mudança no salvo', async () => {
    routeRepository.set('w1', route);
    const { result, rerender } = await renderHook(() => useRoute('w1'));
    const first = result.current;

    await rerender({});
    expect(result.current).toBe(first);

    // Gravar outro treino notifica, mas o trajeto deste não mudou.
    await act(async () => routeRepository.set('w2', other));
    expect(result.current).toBe(first);
  });

  it('acompanha a troca de id', async () => {
    routeRepository.set('w1', route);
    routeRepository.set('w2', other);
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useRoute(id), { initialProps: { id: 'w1' } });
    expect(result.current).toEqual(route);

    await rerender({ id: 'w2' });
    expect(result.current).toEqual(other);
  });

  it('para de ouvir o repositório ao desmontar', async () => {
    const original = routeRepository.subscribe;
    const unsubscribe = jest.fn();
    jest.spyOn(routeRepository, 'subscribe').mockImplementation((listener) => {
      const stop = original(listener);
      return () => {
        unsubscribe();
        stop();
      };
    });
    const { unmount } = await renderHook(() => useRoute('w1'));
    expect(unsubscribe).not.toHaveBeenCalled();

    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
