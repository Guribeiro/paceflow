import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { shoeRepository } from '../../data/shoes';
import { workoutRepository } from '../../data/workouts';
import { CalculatorScreen } from '../CalculatorScreen';
import { SettingsScreen } from '../SettingsScreen';
import { WorkoutLogScreen } from '../WorkoutLogScreen';

beforeEach(() => preferencesRepository.setUnit('km'));

describe('Tênis', () => {
  // Os testes compartilham o MMKV mock deste arquivo; o primeiro roda sem tênis.
  it('cadastra um tênis com km já rodados em Ajustes', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    expect(screen.getByText(/Cadastre seus tênis/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Adicionar tênis' }));
    await user.type(screen.getByLabelText('Nome do tênis'), 'Pegasus');
    await user.type(screen.getByLabelText('Já rodados (km, opcional)'), '600');
    await user.press(screen.getByRole('button', { name: 'Salvar tênis' }));

    expect(shoeRepository.list()).toEqual([
      expect.objectContaining({ name: 'Pegasus', initialMeters: 600_000, limitMeters: 700_000 }),
    ]);
    expect(screen.getByRole('progressbar', { name: /^Pegasus: 600,00 de 700,00 km/ })).toBeOnTheScreen();
  });

  it('o único tênis vem pré-selecionado ao registrar e soma os km', async () => {
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await user.type(screen.getByLabelText(/^Distância/), '50');
    await user.type(screen.getByLabelText('Tempo'), '4:10:00');

    expect(screen.getByRole('radio', { name: 'Pegasus' })).toBeChecked();
    await user.press(screen.getByRole('radio', { name: 'Rua' }));
    await user.press(screen.getByRole('button', { name: 'Salvar treino' }));

    const [shoe] = shoeRepository.list();
    expect(workoutRepository.list()[0].shoeId).toBe(shoe.id);
  });

  it('o diário mostra o tênis do treino e avisa perto da troca', async () => {
    await render(<WorkoutLogScreen />);
    expect(screen.getByText('Tênis: Pegasus')).toBeOnTheScreen();
    // 600 iniciais + 50 do treino = 650 de 700 → perto da troca (≥ 90%)
    expect(screen.getByText(/Perto da troca: Pegasus \(650,00 de 700,00 km\)/)).toBeOnTheScreen();
  });

  it('tênis aposentado some da escolha no registro', async () => {
    const [shoe] = shoeRepository.list();
    shoeRepository.update(shoe.id, { retired: true });
    const user = userEvent.setup();
    await render(<CalculatorScreen />);
    await user.type(screen.getByLabelText(/^Distância/), '5');
    await user.type(screen.getByLabelText('Tempo'), '25:00');
    expect(screen.queryByRole('radio', { name: 'Pegasus' })).not.toBeOnTheScreen();
  });
});
