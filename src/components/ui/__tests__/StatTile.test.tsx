import { render, screen } from '@testing-library/react-native';

import { StatTile } from '../StatTile';

describe('StatTile', () => {
  it('lê rótulo, valor e unidade como uma frase só', async () => {
    await render(<StatTile label="Distância" value="12,5" suffix="km" />);

    expect(screen.getByLabelText('Distância: 12,5 km')).toBeOnTheScreen();
  });

  it('sem unidade, lê só o valor', async () => {
    await render(<StatTile label="Treinos" value="4" />);

    expect(screen.getByLabelText('Treinos: 4')).toBeOnTheScreen();
  });

  it('usa o nome falado no lugar do valor e da unidade', async () => {
    await render(<StatTile label="Tempo" value="25:00" suffix="min" spoken="25 minutos" />);

    expect(screen.getByLabelText('Tempo: 25 minutos')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/25:00/)).toBeNull();
  });

  it('acrescenta o detalhe depois de uma vírgula', async () => {
    await render(<StatTile label="Distância" value="30" suffix="km" detail="5 km a mais que a semana passada" />);

    expect(screen.getByLabelText('Distância: 30 km, 5 km a mais que a semana passada')).toBeOnTheScreen();
    expect(screen.getByText('5 km a mais que a semana passada')).toBeOnTheScreen();
  });

  it('detalhe junto com o nome falado', async () => {
    await render(<StatTile label="Pace" value="5:00" suffix="/km" spoken="5 minutos por quilômetro" detail="melhor do mês" />);

    expect(screen.getByLabelText('Pace: 5 minutos por quilômetro, melhor do mês')).toBeOnTheScreen();
  });

  it('com a unidade abaixo, o rótulo acessível é o mesmo', async () => {
    await render(<StatTile label="Pace" value="5:00" suffix="/km" suffixBelow variant="hero" />);

    expect(screen.getByLabelText('Pace: 5:00 /km')).toBeOnTheScreen();
    expect(screen.getByText('/km')).toBeOnTheScreen();
  });
});
