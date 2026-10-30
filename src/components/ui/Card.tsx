import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { type IconName } from './Icon';
import { SectionHeader } from './SectionHeader';

interface Props
  extends Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityValue' | 'testID'> {
  children: ReactNode;
  /**
   * surface: cartão preenchido sobre o fundo da tela (padrão);
   * hero: laranja com texto branco, para o número principal da tela;
   * soft: laranja-claro, para avisos;
   * outline: só contorno, para cartões dentro de outro cartão.
   */
  variant?: 'surface' | 'hero' | 'soft' | 'outline';
  /** Título com ícone no topo do cartão (vira um cabeçalho para o leitor de tela). */
  title?: string;
  icon?: IconName;
  /** Espaço entre os filhos: 0 para blocos de texto colados, 4 para formulários. */
  gap?: 0 | 1 | 2 | 3 | 4;
  /** p-3 em vez de p-5, para cartões dentro de listas ou grades. */
  compact?: boolean;
  /** Classes de layout extras (largura, flex), nunca de cor ou borda. */
  className?: string;
}

const VARIANT = {
  surface: 'bg-surface dark:bg-surface-dark',
  hero: 'bg-brand dark:bg-brand-dark',
  soft: 'bg-brand-soft dark:bg-brand-soft-dark',
  outline: 'border-2 border-surface-2 dark:border-surface-2-dark',
};

// Literais completos para o NativeWind encontrar as classes.
const GAP = { 0: '', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4' };

/** Cartão padrão do app: mesmo raio, padding e espaçamento em todas as telas. */
export function Card({
  children,
  variant = 'surface',
  title,
  icon,
  gap = 3,
  compact = false,
  className = '',
  ...props
}: Props) {
  return (
    <View {...props} className={`${GAP[gap]} rounded-3xl ${compact ? 'p-3' : 'p-5'} ${VARIANT[variant]} ${className}`}>
      {title ? (
        <SectionHeader level={2} icon={icon} onBrand={variant === 'hero'}>
          {title}
        </SectionHeader>
      ) : null}
      {children}
    </View>
  );
}
