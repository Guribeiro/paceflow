import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

interface Props extends Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole' | 'testID'> {
  children: ReactNode;
  /** outline: contorno; inverted: fundo preto/branco (destaque). */
  variant?: 'outline' | 'inverted';
}

const VARIANT = {
  outline: 'border-2 border-black dark:border-white',
  inverted: 'bg-black dark:bg-white',
};

/** Cartão padrão do app: mesmo raio, padding e espaçamento em todas as telas. */
export function Card({ children, variant = 'outline', ...props }: Props) {
  return (
    <View {...props} className={`gap-3 rounded-xl p-4 ${VARIANT[variant]}`}>
      {children}
    </View>
  );
}
