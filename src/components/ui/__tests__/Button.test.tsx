import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('expõe papel de botão e chama onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Salvar" onPress={onPress} />);

    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('desativado não chama onPress e informa o estado', async () => {
    const onPress = jest.fn();
    await render(<Button label="Salvar" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Salvar' });
    await userEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('usa o nome falado quando difere do texto', async () => {
    await render(<Button label="Excluir" variant="danger-link" accessibilityLabel="Excluir treino" onPress={() => {}} />);

    expect(screen.getByRole('button', { name: 'Excluir treino' })).toBeOnTheScreen();
  });

  it('informa ocupado e expandido', async () => {
    await render(
      <>
        <Button label="Aguarde…" busy disabled onPress={() => {}} />
        <Button label="Ver como tabela" variant="link" expanded={false} onPress={() => {}} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Aguarde…' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Ver como tabela' })).toBeCollapsed();
  });

  it.each(['primary', 'secondary', 'link', 'danger', 'danger-link'] as const)('variante %s renderiza o texto', async (variant) => {
    await render(<Button label="Ok" variant={variant} onPress={() => {}} />);

    expect(screen.getByText('Ok')).toBeOnTheScreen();
  });
});
