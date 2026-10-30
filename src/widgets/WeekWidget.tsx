import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, paddingAll, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WeekWidgetProps } from '../domain/widget-snapshot';

// O componente roda num runtime isolado: sem hooks, estado, async ou
// referências a constantes deste arquivo. Cores ficam dentro da função e
// repetem os hex de src/components/ui/palette.ts (surface, bar, ink, muted, brand-ink).
// widget-colors.test.ts confere que continuam iguais.
// Limitações do Android no SDK 58: tocar no widget não abre o app (só há
// broadcasts de interação), e cornerRadius só tem efeito no Android 12+, assim como
// a cor do LinearProgressIndicator (no Android 11 ele sai no roxo padrão).
const WeekWidget = (props: WeekWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const surface = dark ? '#1A1A1D' : '#FFFFFF';
  // Blocos vazios da meta: `bar` (≥ 3:1 sobre o fundo) para continuarem visíveis.
  const bar = dark ? '#6E6E75' : '#8A8A90';
  const fg = dark ? '#FFFFFF' : '#111111';
  const muted = dark ? '#C8C8CC' : '#4A4A4F';
  const accent = dark ? '#FF7A3D' : '#B33A0A';
  // Meta em 10 blocos de 10%: fundo colorido funciona em qualquer Android, e o
  // Glance não aceita largura fracionada nem informa o tamanho do widget.
  const filled = props.goalRatio === null ? 0 : Math.round(Math.min(1, Math.max(0, props.goalRatio)) * 10);

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
          <Row>
            {Array.from({ length: 10 }, (_, i) => (
              <Row key={i}>
                {i > 0 ? <Spacer modifiers={[width(4)]} /> : null}
                <Spacer modifiers={[size(14, 10), background(i < filled ? accent : bar)]} />
              </Row>
            ))}
          </Row>
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
