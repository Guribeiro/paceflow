import type { ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { useStackedRow } from './ButtonRow';

export type ButtonVariant = 'primary' | 'secondary' | 'link' | 'danger' | 'danger-link';
export type ButtonSize = 'md' | 'lg';

interface Props extends Pick<PressableProps, 'onPress' | 'accessibilityHint' | 'testID'> {
  label: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Ação em andamento: desativa e mostra um indicador ao lado do rótulo. */
  busy?: boolean;
  /** Ocupa a largura disponível numa linha de botões. */
  grow?: boolean;
  /** Nome falado, quando difere do texto visível. */
  accessibilityLabel?: string;
  /** Para botões que mostram/ocultam uma seção. */
  expanded?: boolean;
}

const HEIGHT: Record<ButtonSize, string> = { md: 'min-h-12', lg: 'min-h-14' };
const TEXT_SIZE: Record<ButtonSize, string> = { md: 'text-lg', lg: 'text-xl' };

// Estado desativado único: cinza legível nos dois temas (e não opacidade, que
// deixava texto branco sobre preto ilegível sob sol).
const DISABLED_BOX = 'bg-neutral-300 dark:bg-neutral-700';
const DISABLED_TEXT = 'text-neutral-700 dark:text-neutral-300';

const BOX: Record<ButtonVariant, string> = {
  primary: 'rounded-xl bg-black px-4 dark:bg-white active:opacity-70',
  secondary: 'rounded-xl border-2 border-black px-4 dark:border-white active:opacity-70',
  danger: 'rounded-xl border-2 border-red-700 px-4 dark:border-red-400 active:opacity-70',
  // Sem padding lateral: o texto alinha com o título acima. A área de toque mantém
  // 48 pt de altura e pelo menos 48 pt de largura (min-w-12).
  link: 'min-w-12 self-start active:opacity-60',
  'danger-link': 'min-w-12 self-start active:opacity-60',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'font-bold text-white dark:text-black',
  secondary: 'font-bold text-black dark:text-white',
  danger: 'font-bold text-red-700 dark:text-red-400',
  link: 'text-base font-semibold text-black dark:text-white',
  'danger-link': 'text-base font-semibold text-red-700 dark:text-red-400',
};

// Sublinhado desenhado como borda: no Android (A50, RN 0.88 + NativeWind 4.2) o
// textDecorationLine sumia de forma intermitente após rebuilds; a borda é estável e,
// com 2 px, mais visível sob sol.
const UNDERLINE: Record<'link' | 'danger-link', string> = {
  link: 'border-b-2 border-black dark:border-white',
  'danger-link': 'border-b-2 border-red-700 dark:border-red-400',
};

/** Botão do app: variantes, tamanhos, desativado e feedback de toque padronizados. */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  busy = false,
  grow = false,
  accessibilityLabel,
  expanded,
  ...props
}: Props) {
  // Numa ButtonRow empilhada (fonte grande) o botão ocupa a largura toda, sem flex-1.
  const stacked = useStackedRow();
  const { colorScheme } = useColorScheme();
  const off = disabled || busy;
  const isLink = variant === 'link' || variant === 'danger-link';
  const box = off && !isLink ? `rounded-xl px-4 ${DISABLED_BOX}` : BOX[variant];
  const text = off ? DISABLED_TEXT : LABEL[variant];

  const labelText = isLink ? (
    <View className={off ? 'border-b-2 border-neutral-700 dark:border-neutral-300' : UNDERLINE[variant]}>
      <Text className={off ? `text-base font-semibold ${DISABLED_TEXT}` : text}>{label}</Text>
    </View>
  ) : (
    <Text className={`${TEXT_SIZE[size]} ${text}`}>{label}</Text>
  );

  return (
    <Pressable
      {...props}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: off, busy, expanded }}
      className={`${HEIGHT[size]} items-center justify-center ${grow && !stacked ? 'flex-1' : ''} ${box}`}
    >
      {busy ? (
        <View className="flex-row items-center gap-2">
          {/* Mesma cor do texto desativado (neutral-700 / neutral-300). */}
          <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#d4d4d4' : '#404040'} />
          {labelText}
        </View>
      ) : (
        labelText
      )}
    </Pressable>
  );
}
