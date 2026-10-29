import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { SectionHeader } from './SectionHeader';

interface Props {
  /** Sem título, só o botão (ex.: tabela alternativa a um gráfico). */
  title?: string;
  /** Rótulos do botão, ex.: "Ver projeção" / "Ocultar projeção". */
  showLabel: string;
  hideLabel: string;
  level?: 1 | 2;
  children: ReactNode;
}

/** Seção recolhida: o título fica visível e o conteúdo abre sob demanda (estado só na memória). */
export function Disclosure({ title, showLabel, hideLabel, level = 1, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-2">
      {title ? <SectionHeader level={level}>{title}</SectionHeader> : null}
      <Button
        label={open ? hideLabel : showLabel}
        variant="link"
        expanded={open}
        onPress={() => setOpen((v) => !v)}
      />
      {open ? children : null}
    </View>
  );
}
