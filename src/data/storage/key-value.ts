/** Contrato mínimo de armazenamento chave/valor usado pelos repositórios. */
export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Implementação em memória para testes. */
export class InMemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();

  getString(key: string): string | undefined {
    return this.data.get(key);
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}
