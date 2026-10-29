import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WeekWidgetProps } from '../domain/widget-snapshot';

// O componente roda num runtime isolado: sem hooks, estado, async ou
// referências a constantes deste arquivo. Cores ficam dentro da função.
const WeekWidget = (props: WeekWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const fg = dark ? '#ffffff' : '#000000';
  const muted = dark ? '#d4d4d4' : '#404040';

  return (
    <Column modifiers={[fillMaxSize(), background(dark ? '#000000' : '#ffffff'), cornerRadius(16), paddingAll(12)]}>
      <Text color={muted} maxLines={1} style={{ fontSize: 12, fontWeight: '600' }}>
        {props.weekLabel}
      </Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 32, fontWeight: 'bold' }}>
        {`${props.distance} ${props.unit}`}
      </Text>
      <Text color={fg} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
        {props.count}
      </Text>
      <Text color={muted} maxLines={1} style={{ fontSize: 13, fontWeight: '600' }}>
        {props.lastPace ? `Último: ${props.lastPace}` : 'Registre um treino'}
      </Text>
    </Column>
  );
};

export default createWidget<WeekWidgetProps>('WeekWidget', WeekWidget, {
  weekLabel: 'Esta semana',
  distance: '0,00',
  unit: 'km',
  count: 'Nenhum treino',
  lastPace: null,
});
