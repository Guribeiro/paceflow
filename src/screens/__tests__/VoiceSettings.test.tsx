import * as Speech from 'expo-speech';
import { render, screen, userEvent } from '@testing-library/react-native';

import { preferencesRepository } from '../../data/preferences';
import { voicePreferences } from '../../data/run-voice';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('expo-speech');

const speech = jest.mocked(Speech);
const NOTHING_TO_SAY = /Só o número da parcial será falado/;

beforeEach(() => {
  voicePreferences.update(DEFAULT_VOICE_PREFERENCES);
  preferencesRepository.setUnit('km');
  jest.clearAllMocks();
});

describe('Avisos falados nos Ajustes', () => {
  it('mostra a seção com as preferências padrão', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Avisos falados')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Falar a cada parcial' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Tempo da parcial' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Pace médio' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Tempo total' })).not.toBeChecked();
    expect(screen.queryByText(NOTHING_TO_SAY)).not.toBeOnTheScreen();
  });

  it('desligar a voz salva e esconde as sub-opções; religar mostra de novo', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.press(screen.getByRole('switch', { name: 'Falar a cada parcial' }));
    expect(voicePreferences.get().enabled).toBe(false);
    expect(screen.getByRole('switch', { name: 'Falar a cada parcial' })).not.toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Tempo da parcial' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Pace médio' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: 'Tempo total' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ouvir exemplo' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('switch', { name: 'Falar a cada parcial' }));
    expect(voicePreferences.get().enabled).toBe(true);
    expect(screen.getByRole('switch', { name: 'Tempo da parcial' })).toBeOnTheScreen();
  });

  it('cada item liga e desliga no repositório', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.press(screen.getByRole('switch', { name: 'Tempo total' }));
    expect(voicePreferences.get()).toEqual({ enabled: true, splitTime: true, averagePace: true, totalTime: true });
    expect(screen.getByRole('switch', { name: 'Tempo total' })).toBeChecked();

    await user.press(screen.getByRole('switch', { name: 'Tempo da parcial' }));
    expect(voicePreferences.get()).toEqual({ enabled: true, splitTime: false, averagePace: true, totalTime: true });

    await user.press(screen.getByRole('switch', { name: 'Pace médio' }));
    expect(voicePreferences.get()).toEqual({ enabled: true, splitTime: false, averagePace: false, totalTime: true });
    expect(screen.getByRole('switch', { name: 'Pace médio' })).not.toBeChecked();
  });

  it('avisa que só o número será falado quando os três itens estão desligados', async () => {
    voicePreferences.update({ averagePace: false });
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    expect(screen.queryByText(NOTHING_TO_SAY)).not.toBeOnTheScreen();

    await user.press(screen.getByRole('switch', { name: 'Tempo da parcial' }));
    expect(screen.getByText(NOTHING_TO_SAY)).toBeOnTheScreen();

    await user.press(screen.getByRole('switch', { name: 'Tempo total' }));
    expect(screen.queryByText(NOTHING_TO_SAY)).not.toBeOnTheScreen();
  });

  it('"Ouvir exemplo" fala na unidade escolhida', async () => {
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.press(screen.getByRole('button', { name: 'Ouvir exemplo' }));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Quilômetro 3\./), { language: 'pt-BR' });

    await user.press(screen.getByRole('radio', { name: 'Milhas' }));
    await user.press(screen.getByRole('button', { name: 'Ouvir exemplo' }));
    expect(speech.speak).toHaveBeenLastCalledWith(expect.stringMatching(/^Milha 3\..*por milha\.$/), {
      language: 'pt-BR',
    });
  });

  it('a descrição acompanha a unidade escolhida', async () => {
    preferencesRepository.setUnit('mi');
    await render(<SettingsScreen />);
    expect(screen.getByText('Na aba Correr, a cada milha, mesmo com a tela apagada.')).toBeOnTheScreen();
  });
});
