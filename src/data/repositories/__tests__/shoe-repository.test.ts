import type { Shoe } from '../../../domain/shoe';
import { InMemoryStorage } from '../../storage/key-value';
import { createShoeRepository } from '../shoe-repository';

function setup() {
  const storage = new InMemoryStorage();
  let seq = 0;
  let clock = Date.parse('2026-10-29T10:00:00.000Z');
  const changes: string[][] = [];
  const repo = createShoeRepository(storage, {
    generateId: () => `s-${++seq}`,
    now: () => new Date((clock += 1000)).toISOString(),
    onLocalChange: (ids) => changes.push(ids),
  });
  return { storage, repo, changes };
}

const created = (result: { ok: true; value: Shoe } | { ok: false; error: string }) => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('ShoeRepository', () => {
  it('cadastra com limite padrão de 700 km e km iniciais', () => {
    const { repo } = setup();
    const shoe = created(repo.create({ name: '  Pegasus 41 ', initialMeters: 120_000 }));
    expect(shoe).toMatchObject({ id: 's-1', name: 'Pegasus 41', initialMeters: 120_000, limitMeters: 700_000, retiredAt: null, deletedAt: null });
    expect(repo.list()).toHaveLength(1);
  });

  it.each([
    [{ name: '' }, 'INVALID_NAME'],
    [{ name: 'x'.repeat(61) }, 'INVALID_NAME'],
    [{ name: 'A', initialMeters: -1 }, 'INVALID_INITIAL'],
    [{ name: 'A', limitMeters: 0 }, 'INVALID_LIMIT'],
  ])('%p → %s', (input, error) => {
    const { repo } = setup();
    expect(repo.create(input)).toEqual({ ok: false, error });
  });

  it('edita, aposenta e reativa', () => {
    const { repo } = setup();
    created(repo.create({ name: 'A' }));
    expect(repo.update('s-1', { name: 'B', limitMeters: 800_000 })).toMatchObject({ ok: true, value: { name: 'B', limitMeters: 800_000 } });
    expect(repo.update('s-1', { retired: true })).toMatchObject({ ok: true, value: { retiredAt: expect.any(String) } });
    expect(repo.update('s-1', { retired: false })).toMatchObject({ ok: true, value: { retiredAt: null } });
  });

  it('exclusão lógica', () => {
    const { repo } = setup();
    created(repo.create({ name: 'A' }));
    expect(repo.remove('s-1')).toBe(true);
    expect(repo.list()).toEqual([]);
    expect(repo.getRecord('s-1')?.deletedAt).not.toBeNull();
    expect(repo.update('s-1', { name: 'B' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('avisa alterações locais e não avisa o que veio do servidor', () => {
    const { repo, changes } = setup();
    const shoe = created(repo.create({ name: 'A' }));
    repo.importShoes([{ ...shoe, id: 'remote-1' }], { origin: 'remote' });
    expect(changes).toEqual([['s-1']]);
    expect(repo.list().map((s) => s.id).sort()).toEqual(['remote-1', 's-1']);
  });
});
