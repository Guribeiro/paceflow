import { type AndroidSymbol, type SFSymbol, SymbolView } from 'expo-symbols';

/** Ícones do app: SF Symbol no iOS, Material Symbol no Android e na web. */
const ICONS = {
  run: { ios: 'figure.run', android: 'directions_run' },
  timer: { ios: 'timer', android: 'timer' },
  flag: { ios: 'flag.checkered', android: 'flag' },
  speed: { ios: 'speedometer', android: 'speed' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  trophy: { ios: 'trophy.fill', android: 'trophy' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart' },
  target: { ios: 'scope', android: 'target' },
  fire: { ios: 'flame.fill', android: 'local_fire_department' },
  shoe: { ios: 'shoeprints.fill', android: 'footprint' },
  bell: { ios: 'bell.fill', android: 'notifications' },
  backup: { ios: 'externaldrive.fill', android: 'backup' },
  person: { ios: 'person.crop.circle', android: 'account_circle' },
  palette: { ios: 'paintpalette.fill', android: 'palette' },
  info: { ios: 'info.circle', android: 'info' },
  route: { ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  color: string;
  size?: number;
}

/** Decorativo: o texto ao lado já diz o que é, então o leitor de tela o ignora. */
export function Icon({ name, color, size = 22 }: Props) {
  return (
    <SymbolView
      name={ICONS[name]}
      tintColor={color}
      size={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
