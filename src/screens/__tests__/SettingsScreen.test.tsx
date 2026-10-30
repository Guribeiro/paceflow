import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { autoPausePreference, routePreference } from '../../data/run-session';
import { storage } from '../../data/storage/mmkv';
import { PRIVACY_POLICY_URL, SettingsScreen } from '../SettingsScreen';

beforeEach(() => {
  preferencesRepository.setTheme('system');
  preferencesRepository.setUnit('km');
  autoPausePreference.set(true);
  routePreference.set(true);
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

  it('liga e desliga a pausa automática da corrida', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    const toggle = () => screen.getByRole('switch', { name: 'Pausa automática' });
    expect(toggle()).toBeChecked();

    await user.press(toggle());
    expect(autoPausePreference.get()).toBe(false);
    expect(toggle()).not.toBeChecked();

    await user.press(toggle());
    expect(autoPausePreference.get()).toBe(true);
    expect(toggle()).toBeChecked();
  });

  it('mostra a pausa automática desligada quando foi desligada antes', async () => {
    autoPausePreference.set(false);
    await render(<SettingsScreen />);
    expect(screen.getByRole('switch', { name: 'Pausa automática' })).not.toBeChecked();
  });

  it('liga e desliga guardar o trajeto', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    const toggle = () => screen.getByRole('switch', { name: 'Guardar trajeto' });
    expect(toggle()).toBeChecked();
    expect(screen.getByText('O desenho do percurso fica só neste aparelho.')).toBeOnTheScreen();

    await user.press(toggle());
    expect(routePreference.get()).toBe(false);
    expect(toggle()).not.toBeChecked();
    // Não mexe na pausa automática.
    expect(autoPausePreference.get()).toBe(true);

    await user.press(toggle());
    expect(routePreference.get()).toBe(true);
    expect(toggle()).toBeChecked();
  });

  it('mostra guardar o trajeto desligado quando foi desligado antes', async () => {
    routePreference.set(false);
    await render(<SettingsScreen />);
    expect(screen.getByRole('switch', { name: 'Guardar trajeto' })).not.toBeChecked();
  });

  it('guardar o trajeto vem ligado num aparelho que nunca mexeu nisso', async () => {
    storage.remove('run-route:v1');
    expect(routePreference.get()).toBe(true);
    await render(<SettingsScreen />);
    expect(screen.getByRole('switch', { name: 'Guardar trajeto' })).toBeChecked();
  });

  it('abre a política de privacidade no navegador', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(screen.getByRole('button', { name: 'Política de privacidade' }));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://guribeiro.github.io/paceflow/privacidade.html');
    expect(PRIVACY_POLICY_URL).toBe('https://guribeiro.github.io/paceflow/privacidade.html');
    openURL.mockRestore();
  });
});
