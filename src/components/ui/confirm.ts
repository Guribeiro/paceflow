import { Alert, Platform } from 'react-native';

interface Options {
  title: string;
  message: string;
  /** Rótulo do botão destrutivo, ex.: "Excluir" ou "Remover". */
  confirmLabel: string;
  onConfirm: () => void;
}

/** Confirmação antes de uma ação destrutiva, igual em todo o app. */
export function confirmDestructive({ title, message, confirmLabel, onConfirm }: Options) {
  // No react-native-web o Alert.alert não faz nada; usa o confirm do navegador.
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
