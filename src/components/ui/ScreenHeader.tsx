import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useLargeText } from '../../hooks/useLargeText';

interface Props {
  title: string;
  /** Linha curta acima do título (ex.: o dia da semana). */
  eyebrow?: string;
  /** Controle à direita do título (ex.: UnitToggle); com fonte grande vai para baixo. */
  action?: ReactNode;
}

/** Topo das telas: título grande, uma linha de contexto opcional e uma ação. */
export function ScreenHeader({ title, eyebrow, action }: Props) {
  const large = useLargeText();

  return (
    <View className={large ? 'flex-col items-start gap-3' : 'flex-row items-end justify-between gap-3'}>
      <View className="shrink">
        {eyebrow ? (
          <Text className="text-sm font-bold uppercase tracking-widest text-brand-ink dark:text-brand-ink-dark">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-4xl font-extrabold text-ink dark:text-ink-dark" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}
