import type { Route } from '../../../domain/route';
import { InMemoryStorage } from '../../storage/key-value';
import { createRouteRepository } from '../route-repository';

const route: Route = [
  [
    [-23.55, -46.63],
    [-23.551, -46.631],
  ],
];
const other: Route = [[[-22.9, -43.2]]];

function setup() {
  const storage = new InMemoryStorage();
  const repo = createRouteRepository(storage);
  const notified = jest.fn();
  repo.subscribe(notified);
  return { storage, repo, notified };
}

describe('RouteRepository', () => {
  it('sem trajeto: get null e has falso', () => {
    const { repo } = setup();
    expect(repo.get('w1')).toBeNull();
    expect(repo.has('w1')).toBe(false);
  });

  it('guarda, lê e remove pelo id do treino', () => {
    const { repo, storage, notified } = setup();
    repo.set('w1', route);
    expect(storage.getString('routes:v1:w1')).toBe(JSON.stringify(route));
    expect(repo.has('w1')).toBe(true);
    expect(repo.get('w1')).toEqual(route);
    expect(repo.get('w2')).toBeNull();

    repo.remove('w1');
    expect(repo.has('w1')).toBe(false);
    expect(repo.get('w1')).toBeNull();
    expect(notified).toHaveBeenCalledTimes(2);
  });

  it('devolve a mesma referência enquanto o salvo não muda', () => {
    const { repo } = setup();
    repo.set('w1', route);
    const first = repo.get('w1');
    expect(repo.get('w1')).toBe(first);

    repo.set('w1', other);
    expect(repo.get('w1')).toEqual(other);
  });

  it('remover e regravar o mesmo trajeto lê o novo valor', () => {
    const { repo } = setup();
    repo.set('w1', route);
    repo.get('w1');
    repo.remove('w1');
    repo.set('w1', route);
    expect(repo.get('w1')).toEqual(route);
  });

  it.each([
    ['JSON quebrado', '[[[-23.5'],
    ['trajeto inválido', JSON.stringify([[[91, 0]]])],
    ['objeto', JSON.stringify({ a: 1 })],
  ])('tolera salvo corrompido (%s): get null, mas has verdadeiro', (_name, raw) => {
    const { repo, storage } = setup();
    storage.set('routes:v1:w1', raw);
    expect(repo.get('w1')).toBeNull();
    expect(repo.has('w1')).toBe(true);
  });

  it('importa só os trajetos de treinos que ainda não têm um', () => {
    const { repo, notified } = setup();
    repo.set('w1', route);
    notified.mockClear();

    expect(repo.importRoutes({ w1: other, w2: other, w3: route })).toBe(2);
    expect(repo.get('w1')).toEqual(route);
    expect(repo.get('w2')).toEqual(other);
    expect(repo.get('w3')).toEqual(route);
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('importar nada novo não avisa', () => {
    const { repo, notified } = setup();
    repo.set('w1', route);
    notified.mockClear();
    expect(repo.importRoutes({ w1: other })).toBe(0);
    expect(repo.importRoutes({})).toBe(0);
    expect(notified).not.toHaveBeenCalled();
  });

  it('cancelar a inscrição para de avisar', () => {
    const { repo } = setup();
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    unsubscribe();
    repo.set('w1', route);
    expect(listener).not.toHaveBeenCalled();
  });
});
