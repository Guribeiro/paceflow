import { Button, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxWidth, paddingAll, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createCustomNotification, type CustomNotificationEnvironment } from 'expo-widgets';

import type { RunNotificationProps, RunSummaryProps } from '../domain/run-notification';

// Mesmo runtime isolado do WeekWidget: sem hooks, estado ou constantes deste
// arquivo. As cores repetem src/components/ui/palette.ts (ink, muted, bar,
// brand-ink); widget-colors.test.ts confere que continuam iguais.
// O Button do @expo/ui não declara `target`, mas o expo-widgets lê esse campo
// no Android: é ele que liga o botão ao addUserInteractionListener.

/** Corrida em andamento: tempo, distância e pace; expandida, a parcial e Pausar/Retomar. */
export const RunNotification = createCustomNotification(
  'RunNotification',
  (props: RunNotificationProps, environment: CustomNotificationEnvironment) => {
    'widget';
    const dark = environment.colorScheme === 'dark';
    const fg = dark ? '#FFFFFF' : '#111111';
    const muted = dark ? '#C8C8CC' : '#4A4A4F';
    const bar = dark ? '#6E6E75' : '#8A8A90';
    const accent = dark ? '#FF7A3D' : '#B33A0A';
    const status =
      props.status === 'paused' ? 'Pausada' : props.status === 'autoPaused' ? 'Pausa automática' : 'Correndo';
    const pace = props.pace ? `${props.pace}/${props.unit}` : `--/${props.unit}`;
    const filled = Math.round(Math.min(1, Math.max(0, props.splitProgress)) * 10);
    const paused = props.status === 'paused';

    const summary = (
      <Row modifiers={[fillMaxWidth()]}>
        <Text color={fg} maxLines={1} style={{ fontSize: 26, fontWeight: 'bold' }}>
          {props.time}
        </Text>
        <Spacer modifiers={[width(16)]} />
        <Column>
          <Text color={fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
            {`${props.distance} ${props.unit}`}
          </Text>
          <Text color={muted} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
            {pace}
          </Text>
        </Column>
      </Row>
    );

    return {
      collapsed: (
        <Column modifiers={[paddingAll(4)]}>
          <Text color={accent} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
            {status}
          </Text>
          {summary}
        </Column>
      ),
      expanded: (
        <Column modifiers={[paddingAll(4)]}>
          <Text color={accent} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
            {status}
          </Text>
          {summary}
          <Spacer modifiers={[size(1, 8)]} />
          <Text color={muted} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
            {props.lastSplit ?? 'Primeira parcial em andamento'}
          </Text>
          <Spacer modifiers={[size(1, 6)]} />
          <Row>
            {Array.from({ length: 10 }, (_, i) => (
              <Row key={i}>
                {i > 0 ? <Spacer modifiers={[width(4)]} /> : null}
                <Spacer modifiers={[size(18, 8), background(i < filled ? accent : bar)]} />
              </Row>
            ))}
          </Row>
          <Spacer modifiers={[size(1, 8)]} />
          <Button {...({ target: paused ? 'resume' : 'pause' } as object)} colors={{ containerColor: accent, contentColor: '#FFFFFF' }}>
            <Text color="#FFFFFF" style={{ fontSize: 15, fontWeight: 'bold' }}>
              {paused ? 'Retomar' : 'Pausar'}
            </Text>
          </Button>
        </Column>
      ),
    };
  },
);

/** Corrida finalizada: resumo que some sozinho; tocar abre a tela de salvar. */
export const RunSummaryNotification = createCustomNotification(
  'RunSummaryNotification',
  (props: RunSummaryProps, environment: CustomNotificationEnvironment) => {
    'widget';
    const dark = environment.colorScheme === 'dark';
    const fg = dark ? '#FFFFFF' : '#111111';
    const muted = dark ? '#C8C8CC' : '#4A4A4F';
    const accent = dark ? '#FF7A3D' : '#B33A0A';
    return {
      collapsed: (
        <Column modifiers={[paddingAll(4)]}>
          <Text color={accent} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
            Corrida finalizada · toque para salvar
          </Text>
          <Text color={fg} maxLines={1} style={{ fontSize: 18, fontWeight: 'bold' }}>
            {`${props.distance} ${props.unit} em ${props.time}`}
          </Text>
          {props.pace ? (
            <Text color={muted} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
              {`Pace médio ${props.pace}/${props.unit}`}
            </Text>
          ) : null}
        </Column>
      ),
    };
  },
);
