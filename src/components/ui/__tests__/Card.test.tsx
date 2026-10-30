import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../Card';

describe('Card', () => {
  it('com título, mostra um cabeçalho acessível antes do conteúdo', async () => {
    await render(
      <Card title="Parciais" icon="flag">
        <Text>1 km</Text>
      </Card>,
    );

    expect(screen.getByRole('header', { name: 'Parciais' })).toBeOnTheScreen();
    expect(screen.getByText('1 km')).toBeOnTheScreen();
  });

  it('título sem ícone e no cartão hero também é cabeçalho', async () => {
    await render(
      <Card title="Meta da semana" variant="hero">
        <Text>20 km</Text>
      </Card>,
    );

    expect(screen.getByRole('header', { name: 'Meta da semana' })).toBeOnTheScreen();
  });

  it('sem título, não cria cabeçalho', async () => {
    await render(
      <Card>
        <Text>Conteúdo</Text>
      </Card>,
    );

    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.getByText('Conteúdo')).toBeOnTheScreen();
  });
});
