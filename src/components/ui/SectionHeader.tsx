import { Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { ON_BRAND, usePalette } from './palette';

interface Props {
  children: string;
  /** 1: título de seção; 2: subtítulo dentro de uma seção. */
  level?: 1 | 2;
  /** Ícone laranja à esquerda do título. */
  icon?: IconName;
  /** Dentro de um Card hero: texto e ícone brancos. */
  onBrand?: boolean;
}

/** Título de seção com papel de cabeçalho (o leitor de tela navega por eles). */
export function SectionHeader({ children, level = 1, icon, onBrand = false }: Props) {
  const palette = usePalette();
  const text = (
    <Text
      accessibilityRole="header"
      className={`${level === 1 ? 'text-2xl font-extrabold' : 'text-lg font-bold'} ${
        onBrand ? 'text-white' : 'text-ink dark:text-ink-dark'
      } ${icon ? 'flex-1' : ''}`}
    >
      {children}
    </Text>
  );
  if (!icon) return text;

  return (
    <View className="flex-row items-center gap-2">
      <Icon name={icon} color={onBrand ? ON_BRAND : palette.brandInk} size={level === 1 ? 26 : 22} />
      {text}
    </View>
  );
}
