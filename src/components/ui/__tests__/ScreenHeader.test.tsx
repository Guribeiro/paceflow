import { render, screen } from '@testing-library/react-native';

import { Button } from '../Button';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('o título é um cabeçalho para o leitor de tela', async () => {
    await render(<ScreenHeader title="Diário" />);

    expect(screen.getByRole('header', { name: 'Diário' })).toBeOnTheScreen();
  });

  it('mostra a linha de contexto acima do título, fora do cabeçalho', async () => {
    await render(<ScreenHeader title="Correr" eyebrow="Quarta-feira" />);

    expect(screen.getByText('Quarta-feira')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: /Quarta-feira/ })).toBeNull();
    expect(screen.getByRole('header', { name: 'Correr' })).toBeOnTheScreen();
  });

  it('renderiza a ação ao lado do título', async () => {
    await render(<ScreenHeader title="Calculadora" action={<Button label="km" onPress={() => {}} />} />);

    expect(screen.getByRole('button', { name: 'km' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Calculadora' })).toBeOnTheScreen();
  });
});
