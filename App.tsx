import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
      <Text className="text-4xl font-bold text-black dark:text-white">PaceFlow</Text>
      <Text className="mt-2 text-lg text-neutral-700 dark:text-neutral-300">
        Seu ritmo, seus dados, zero distrações.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}
