import { Pressable, Text, View } from 'react-native';

interface Props {
  label: string;
  /** Explicação curta abaixo do rótulo (também é lida pelo leitor de tela). */
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Linha inteira tocável com chave liga/desliga (laranja quando ligada). */
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
        <Text className="text-lg font-bold text-ink dark:text-ink-dark">{label}</Text>
        {description ? <Text className="text-base text-muted dark:text-muted-dark">{description}</Text> : null}
      </View>
      {/* Desligada: trilho com borda em `bar` (≥ 3:1) para não sumir no fundo. */}
      <View
        className={`h-8 w-14 justify-center rounded-full border-2 px-1 ${
          value
            ? 'items-end border-brand bg-brand dark:border-brand-dark dark:bg-brand-dark'
            : 'items-start border-bar dark:border-bar-dark'
        }`}
      >
        <View className={`h-5 w-5 rounded-full ${value ? 'bg-white' : 'bg-bar dark:bg-bar-dark'}`} />
      </View>
    </Pressable>
  );
}
