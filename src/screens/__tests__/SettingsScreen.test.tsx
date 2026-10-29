import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { SettingsScreen } from '../SettingsScreen';

beforeEach(() => {
  preferencesRepository.setTheme('system');
  preferencesRepository.setUnit('km');
});

describe('SettingsScreen', () => {
  it('mostra o tema e a unidade atuais', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByRole('radio', { name: 'Tema do sistema' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Quilômetros' })).toBeChecked();
  });

  it('salva o tema escolhido', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByRole('radio', { name: 'Tema escuro' }));
    expect(preferencesRepository.getTheme()).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Tema escuro' })).toBeChecked();
  });

  it('tocar no tema ativo não desmarca', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByRole('radio', { name: 'Tema do sistema' }));
    expect(preferencesRepository.getTheme()).toBe('system');
  });

  it('salva a unidade padrão', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByRole('radio', { name: 'Milhas' }));
    expect(preferencesRepository.getUnit()).toBe('mi');
  });
});
