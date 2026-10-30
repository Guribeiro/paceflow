import type { TextStyle } from 'react-native';

/** Dígitos de largura fixa: números (pace, tempo, km) não "pulam" ao mudar. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Números de destaque (pace, tempo, distância, cronômetro): Inter, embutida no
 * Android com os pesos 600, 700 e 800 (app.json), então font-semibold/bold valem.
 * Fora do Android a família não existe e cai na fonte do sistema.
 */
export const display: TextStyle = { ...tabular, fontFamily: 'Inter' };
