import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CalculatorScreen } from './src/screens/CalculatorScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <CalculatorScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
