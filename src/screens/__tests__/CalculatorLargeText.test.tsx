import { render, screen } from '@testing-library/react-native';

import { useLargeText } from '../../hooks/useLargeText';
import { CalculatorScreen } from '../CalculatorScreen';

jest.mock('../../hooks/useLargeText', () => ({
  ...jest.requireActual('../../hooks/useLargeText'),
  useLargeText: jest.fn(),
}));
const mockUseLargeText = jest.mocked(useLargeText);

describe('CalculatorScreen com fonte do sistema', () => {
  it('mantém campos e resultados lado a lado na escala normal', async () => {
    mockUseLargeText.mockReturnValue(false);
    await render(<CalculatorScreen />);
    expect(screen.getByTestId('calculator-fields').props.className).toContain('flex-row');
    expect(screen.getByTestId('calculator-results').props.className).toContain('flex-row');
  });

  it('empilha campos e resultados com fonte grande', async () => {
    mockUseLargeText.mockReturnValue(true);
    await render(<CalculatorScreen />);
    expect(screen.getByTestId('calculator-fields').props.className).toContain('flex-col');
    expect(screen.getByTestId('calculator-results').props.className).toContain('flex-col');
  });

  it('limita a escala dos números gigantes', async () => {
    mockUseLargeText.mockReturnValue(true);
    await render(<CalculatorScreen />);
    expect(screen.getByText('--:--').props.maxFontSizeMultiplier).toBe(1.6);
  });
});
