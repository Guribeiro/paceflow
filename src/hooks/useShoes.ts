import { useSyncExternalStore } from 'react';

import { shoeRepository } from '../data/shoes';

/** Tênis não excluídos (inclui aposentados). */
export function useShoes() {
  return useSyncExternalStore(shoeRepository.subscribe, shoeRepository.list);
}
