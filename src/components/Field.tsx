import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface Props extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType'> {
  label: string;
  error?: string;
}

export function Field({ label, error, ...inputProps }: Props) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-base font-semibold text-neutral-800 dark:text-neutral-200">{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCorrect={false}
        className={`min-h-14 rounded-xl border-2 px-4 text-2xl font-bold text-black dark:text-white ${
          error ? 'border-red-700 dark:border-red-400' : 'border-black dark:border-white'
        }`}
        placeholderTextColor="#737373"
        style={{ fontVariant: ['tabular-nums'] }}
      />
      {error ? <Text className="mt-1 text-base font-semibold text-red-700 dark:text-red-400">{error}</Text> : null}
    </View>
  );
}
