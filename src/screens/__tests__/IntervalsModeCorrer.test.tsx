import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { preferencesRepository } from '../../data/preferences';
import { trainingPaces } from '../../domain/pace';
import { CalculatorScreen } from '../CalculatorScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const navigate = jest.mocked(router.navigate);
const RUN_BUTTON = { name: 'Correr intervalado com este pace' };

beforeEach(() => {
  preferencesRepository.setUnit('km');
  jest.clearAllMocks();
});

async function openIntervals() {
  const user = userEvent.setup();
  await render(<CalculatorScreen />);
  await user.press(screen.getByRole('radio', { name: 'Tiros' }));
  return user;
}

describe('Modo Tiros: correr intervalado com o pace', () => {
  it('leva à aba Correr com o pace-alvo em s/km', async () => {
    const user = await openIntervals();
    await user.type(screen.getByLabelText('Pace-alvo (min/km)'), '3:50');
    await user.press(screen.getByRole('button', RUN_BUTTON));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/correr',
      params: { alvo: '230', envio: expect.any(String) },
    });
  });

  it('em milhas, converte o pace para s/km', async () => {
    preferencesRepository.setUnit('mi');
    const user = await openIntervals();
    // 6:10/mi = 370 s / 1,609344 = 229,9 s/km.
    await user.type(screen.getByLabelText('Pace-alvo (min/mi)'), '6:10');
    await user.press(screen.getByRole('button', RUN_BUTTON));
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/correr',
      params: { alvo: '230', envio: expect.any(String) },
    });
  });

  it('usa o pace sugerido pelo modo Ritmo quando não há pace digitado', async () => {
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await user.type(screen.getByLabelText(/^Distância/), '5');
    await user.type(screen.getByLabelText('Tempo'), '19:57');
    await user.press(screen.getByRole('radio', { name: 'Tiros' }));
    expect(screen.getByLabelText('400 metros: 1 minuto e 34 segundos')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', RUN_BUTTON));

    const paces = trainingPaces(5, 19 * 60 + 57);
    if (!paces.ok) throw new Error('esforço de referência inválido');
    const alvo = String(Math.round(paces.value.interval.fastest));
    expect(navigate).toHaveBeenCalledWith({
      pathname: '/correr',
      params: { alvo, envio: expect.any(String) },
    });
  });

  it('sem pace, não oferece o botão', async () => {
    await openIntervals();
    expect(screen.queryByRole('button', RUN_BUTTON)).toBeNull();
  });
});
