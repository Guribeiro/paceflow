import { type ReactNode, createContext, useContext } from 'react';
import { View } from 'react-native';

import { useLargeText } from '../../hooks/useLargeText';

const StackedContext = createContext(false);

/** true dentro de uma ButtonRow empilhada: o `grow` do Button deixa de valer. */
export const useStackedRow = () => useContext(StackedContext);

/** Linha de botões (ex.: Cancelar/Salvar); com fonte grande empilha em largura total. */
export function ButtonRow({ children }: { children: ReactNode }) {
  const large = useLargeText();
  return (
    <StackedContext.Provider value={large}>
      <View className={`${large ? 'flex-col' : 'flex-row'} gap-3`}>{children}</View>
    </StackedContext.Provider>
  );
}
