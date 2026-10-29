import { Text } from 'react-native';

interface Props {
  children: string;
  /** 1: título de seção; 2: subtítulo dentro de uma seção. */
  level?: 1 | 2;
}

/** Título de seção com papel de cabeçalho (o leitor de tela navega por eles). */
export function SectionHeader({ children, level = 1 }: Props) {
  return (
    <Text
      accessibilityRole="header"
      className={`${level === 1 ? 'text-2xl' : 'text-lg'} font-bold text-black dark:text-white`}
    >
      {children}
    </Text>
  );
}
