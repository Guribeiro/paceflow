import { act, renderHook } from '@testing-library/react-native';
import { colorScheme } from 'nativewind';
import { Platform } from 'react-native';
import * as ReactNative from 'react-native';

import { preferencesRepository } from '../../data/preferences';
import { useApplyTheme } from '../useApplyTheme';
import { applyStoredTheme, useThemePreference } from '../useThemePreference';

const setScheme = jest.spyOn(colorScheme, 'set').mockImplementation(() => {});
const systemScheme = jest.spyOn(ReactNative, 'useColorScheme');

beforeEach(() => {
  setScheme.mockClear();
  systemScheme.mockReturnValue('light');
  preferencesRepository.setTheme('system');
});

describe('useApplyTheme no nativo', () => {
  it('repassa a preferência, inclusive "system"', async () => {
    await renderHook(() => useApplyTheme());
    expect(setScheme).toHaveBeenLastCalledWith('system');

    await act(async () => preferencesRepository.setTheme('dark'));
    expect(setScheme).toHaveBeenLastCalledWith('dark');
  });
});

describe('useApplyTheme na web', () => {
  let platform: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, 'OS', 'web');
  });
  afterEach(() => platform.restore());

  it('resolve "system" pelo tema do navegador', async () => {
    systemScheme.mockReturnValue('dark');
    await renderHook(() => useApplyTheme());
    expect(setScheme).toHaveBeenLastCalledWith('dark');
  });

  it('força o tema escolhido mesmo com o navegador no escuro', async () => {
    systemScheme.mockReturnValue('dark');
    preferencesRepository.setTheme('light');
    await renderHook(() => useApplyTheme());
    expect(setScheme).toHaveBeenLastCalledWith('light');
  });
});

describe('applyStoredTheme', () => {
  it('aplica o tema salvo na hora, sem esperar um render', () => {
    preferencesRepository.setTheme('light');
    applyStoredTheme();
    expect(setScheme).toHaveBeenCalledWith('light');
  });

  it('trocar o tema pelo hook já pede a troca, sem esperar o re-render', async () => {
    const { result } = await renderHook(() => useThemePreference());
    setScheme.mockClear();
    result.current[1]('dark');
    expect(setScheme).toHaveBeenCalledWith('dark');
    expect(preferencesRepository.getTheme()).toBe('dark');
  });

  it('não faz nada na web, onde o hook resolve o tema do navegador', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'web');
    preferencesRepository.setTheme('dark');
    applyStoredTheme();
    expect(setScheme).not.toHaveBeenCalled();
    platform.restore();
  });
});
