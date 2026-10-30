import { Column, LinearProgressIndicator, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WeekWidgetProps } from '../domain/widget-snapshot';

// O componente roda num runtime isolado: sem hooks, estado, async ou
// referências a constantes deste arquivo. Cores ficam dentro da função e
// repetem os hex de src/components/ui/palette.ts (surface, ink, muted, brand-ink).
// widget-colors.test.ts confere que continuam iguais.
// Limitações do Android no SDK 58: tocar no widget não abre o app (só há
// broadcasts de interação), e cornerRadius só tem efeito no Android 12+.
const WeekWidget = (props: WeekWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const surface = dark ? '#1A1A1D' : '#FFFFFF';
  const surface2 = dark ? '#26262A' : '#E9E9EC';
  const fg = dark ? '#FFFFFF' : '#111111';
  const muted = dark ? '#C8C8CC' : '#4A4A4F';
  const accent = dark ? '#FF7A3D' : '#B33A0A';

  // Centraliza o bloco para o widget ficar equilibrado em qualquer tamanho.
  // O expo-widgets só traduz top/center/bottom para o Glance; spaceBetween
  // e weight não são suportados e cairiam em "top".
  return (
    <Column
      verticalArrangement="center"
      modifiers={[fillMaxSize(), cornerRadius(16), background(surface), paddingAll(14)]}
    >
      <Text color={accent} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
        {props.weekLabel}
      </Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 36, fontWeight: 'bold' }}>
        {`${props.distance} ${props.unit}`}
      </Text>
      <Column>
        <Text color={fg} maxLines={1} style={{ fontSize: 15, fontWeight: '600' }}>
          {props.count}
        </Text>
        <Text color={muted} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
          {props.lastPace ? `Último: ${props.lastPace}` : 'Registre um treino'}
        </Text>
        {props.goal ? (
          <Text color={fg} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold' }}>
            {props.goal}
          </Text>
        ) : null}
        {props.goalRatio !== null ? (
          <LinearProgressIndicator
            progress={props.goalRatio}
            color={accent}
            trackColor={surface2}
            modifiers={[fillMaxWidth()]}
          />
        ) : null}
      </Column>
    </Column>
  );
};

export default createWidget<WeekWidgetProps>('WeekWidget', WeekWidget, {
  weekLabel: 'Esta semana',
  distance: '0,00',
  unit: 'km',
  count: 'Nenhum treino',
  lastPace: null,
  goal: null,
  goalRatio: null,
});
