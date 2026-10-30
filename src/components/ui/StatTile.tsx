import { Text } from 'react-native';

import { BIG_NUMBER_MAX_SCALE } from '../../hooks/useLargeText';
import { Card } from './Card';
import { display } from './typography';

interface Props {
  label: string;
  value: string;
  /** Unidade depois do número, menor (ex.: "km", "/km"). */
  suffix?: string;
  /** Unidade numa linha própria abaixo do número, para caber em meia largura. */
  suffixBelow?: boolean;
  /** Linha extra abaixo do número (ex.: comparação com a semana anterior). */
  detail?: string;
  /** Nome falado do valor, quando difere do texto (ex.: "25 minutos" em vez de "25:00"). */
  spoken?: string;
  /** md: grades de estatísticas; lg: números da corrida ao vivo. */
  size?: 'md' | 'lg';
  /** hero: fundo laranja, para o número principal da tela. */
  variant?: 'surface' | 'hero';
  className?: string;
}

const VALUE_SIZE = { md: 'text-3xl', lg: 'text-5xl' };

/** Cartão com um número de destaque e o rótulo acima; lido como uma frase só. */
export function StatTile({
  label,
  value,
  suffix,
  suffixBelow = false,
  detail,
  spoken,
  size = 'md',
  variant = 'surface',
  className = 'min-w-36 flex-1',
}: Props) {
  const hero = variant === 'hero';
  const secondary = hero ? 'text-white' : 'text-muted dark:text-muted-dark';

  return (
    <Card
      variant={variant}
      accessible
      accessibilityLabel={`${label}: ${spoken ?? `${value}${suffix ? ` ${suffix}` : ''}`}${detail ? `, ${detail}` : ''}`}
      gap={1}
      compact={size === 'md'}
      className={className}
    >
      <Text className={`text-sm font-semibold uppercase tracking-wide ${secondary}`}>{label}</Text>
      <Text
        className={`${VALUE_SIZE[size]} font-extrabold ${hero ? 'text-white' : 'text-ink dark:text-ink-dark'}`}
        style={display}
        maxFontSizeMultiplier={BIG_NUMBER_MAX_SCALE}
      >
        {value}
        {suffix && !suffixBelow ? (
          <Text className={size === 'lg' ? 'text-xl font-semibold' : 'text-lg font-semibold'}> {suffix}</Text>
        ) : null}
      </Text>
      {suffix && suffixBelow ? <Text className={`text-base font-semibold ${secondary}`}>{suffix}</Text> : null}
      {detail ? <Text className={`text-sm font-semibold ${secondary}`}>{detail}</Text> : null}
    </Card>
  );
}
