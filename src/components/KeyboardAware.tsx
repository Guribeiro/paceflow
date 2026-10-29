import type { ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';

/**
 * Encolhe a área da tela quando o teclado abre. Com o edge-to-edge do RN 0.88
 * o Android não redimensiona mais a janela (adjustResize), e campos na parte de
 * baixo (nota, meta, tempo dos tiros) ficavam cobertos pelo teclado.
 */
export function KeyboardAware({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      {children}
    </KeyboardAvoidingView>
  );
}
