import { useColorScheme } from 'nativewind';

// Contraste ≥ 4,5:1 (AA) nos dois temas: #737373 sobre branco ≈ 4,7:1 e
// #8f8f8f sobre preto ≈ 6,6:1. O antigo #737373 fixo dava ≈ 4,4:1 no escuro.
const PLACEHOLDER = { light: '#737373', dark: '#8f8f8f' } as const;

export function usePlaceholderColor(): string {
  const { colorScheme } = useColorScheme();
  return PLACEHOLDER[colorScheme === 'dark' ? 'dark' : 'light'];
}
