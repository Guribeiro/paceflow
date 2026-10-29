import { Pressable, Text, View } from 'react-native';

interface Props {
  label: string;
  /** Explicação curta abaixo do rótulo (também é lida pelo leitor de tela). */
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Linha inteira tocável com chave liga/desliga de alto contraste. */
export function Toggle({ label, description, value, onChange }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      className="min-h-12 flex-row items-center gap-4 active:opacity-70"
    >
      <View className="flex-1 gap-1">
        <Text className="text-lg font-bold text-black dark:text-white">{label}</Text>
        {description ? <Text className="text-base text-neutral-700 dark:text-neutral-300">{description}</Text> : null}
      </View>
      <View
        className={`h-8 w-14 justify-center rounded-full border-2 border-black px-1 dark:border-white ${
          value ? 'items-end bg-black dark:bg-white' : 'items-start'
        }`}
      >
        <View className={`h-5 w-5 rounded-full ${value ? 'bg-white dark:bg-black' : 'bg-black dark:bg-white'}`} />
      </View>
    </Pressable>
  );
}
