import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { type Route, routeToSvg } from '../domain/route';
import { usePalette } from './ui/palette';

// Coordenadas do desenho num quadrado de 100: o SVG escala até a largura do cartão.
const SIZE = 100;
const PADDING = 6;

/** Desenho do percurso, sem mapa de fundo: traço laranja, início e fim marcados. */
export function RouteMap({ route }: { route: Route }) {
  const palette = usePalette();
  const drawing = routeToSvg(route, SIZE, PADDING);
  if (!drawing) return null;

  return (
    <View
      className="aspect-square w-full rounded-xl bg-canvas dark:bg-canvas-dark"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Trajeto da corrida, com início e fim marcados"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {drawing.paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={palette.brandInk}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        <Circle cx={drawing.start.x} cy={drawing.start.y} r={2.2} fill={palette.surface} stroke={palette.ink} strokeWidth={1} />
        <Circle cx={drawing.end.x} cy={drawing.end.y} r={2.2} fill={palette.brandInk} stroke={palette.surface} strokeWidth={1} />
      </Svg>
    </View>
  );
}
