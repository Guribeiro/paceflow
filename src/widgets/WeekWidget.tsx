import { Column, LinearProgressIndicator, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WeekWidgetProps } from '../domain/widget-snapshot';

// O componente roda num runtime isolado: sem hooks, estado, async ou
// referências a constantes deste arquivo. Cores ficam dentro da função.
// Limitações do Android no SDK 58: tocar no widget não abre o app (só há
// broadcasts de interação), e cornerRadius só tem efeito no Android 12+.
const WeekWidget = (props: WeekWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const fg = dark ? '#ffffff' : '#000000';
  const muted = dark ? '#d4d4d4' : '#404040';

  // Centraliza o bloco para o widget ficar equilibrado em qualquer tamanho.
  // O expo-widgets só traduz top/center/bottom para o Glance; spaceBetween
  // e weight não são suportados e cairiam em "top".
  return (
    <Column
      verticalArrangement="center"
      modifiers={[fillMaxSize(), cornerRadius(16), background(dark ? '#000000' : '#ffffff'), paddingAll(14)]}
    >
      <Text color={muted} maxLines={1} style={{ fontSize: 13, fontWeight: '600' }}>
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
            color={fg}
            trackColor={dark ? '#525252' : '#d4d4d4'}
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
