import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { usePlaceholderColor } from './placeholder-color';
import { tabular } from './ui/typography';

interface Props extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize' | 'autoComplete'
  > {
  label: string;
  error?: string;
  /** false quando o campo está numa coluna: flex-1 encolheria a altura a zero. */
  fill?: boolean;
  /** number: valores grandes e tabulares (pace, tempo); text: texto livre (nota, nome). */
  variant?: 'number' | 'text';
}

export function Field({ label, error, fill = true, variant = 'number', ...inputProps }: Props) {
  const placeholderColor = usePlaceholderColor();
  const isNumber = variant === 'number';

  return (
    <View className={fill ? 'flex-1' : undefined}>
      <Text className="mb-1 text-base font-semibold text-neutral-800 dark:text-neutral-200">{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error}
        autoCorrect={false}
        className={`rounded-xl border-2 px-4 text-black dark:text-white ${
          isNumber ? 'min-h-14 text-2xl font-bold' : 'min-h-12 text-lg'
        } ${error ? 'border-red-700 dark:border-red-400' : 'border-black dark:border-white'}`}
        placeholderTextColor={placeholderColor}
        style={isNumber ? tabular : undefined}
      />
      {error ? <Text className="mt-1 text-base font-semibold text-red-700 dark:text-red-400">{error}</Text> : null}
    </View>
  );
}
