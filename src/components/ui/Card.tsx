import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

interface Props
  extends Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityValue' | 'testID'> {
  children: ReactNode;
  /** outline: contorno; inverted: fundo preto/branco (destaque). */
  variant?: 'outline' | 'inverted';
  /** Espaço entre os filhos: 0 para blocos de texto colados, 4 para formulários. */
  gap?: 0 | 1 | 2 | 3 | 4;
  /** p-3 em vez de p-4, para cartões dentro de listas ou grades. */
  compact?: boolean;
  /** Classes de layout extras (largura, flex), nunca de cor ou borda. */
  className?: string;
}

const VARIANT = {
  outline: 'border-2 border-black dark:border-white',
  inverted: 'bg-black dark:bg-white',
};

// Literais completos para o NativeWind encontrar as classes.
const GAP = { 0: '', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4' };

/** Cartão padrão do app: mesmo raio, padding e espaçamento em todas as telas. */
export function Card({ children, variant = 'outline', gap = 3, compact = false, className = '', ...props }: Props) {
  return (
    <View {...props} className={`${GAP[gap]} rounded-xl ${compact ? 'p-3' : 'p-4'} ${VARIANT[variant]} ${className}`}>
      {children}
    </View>
  );
}
