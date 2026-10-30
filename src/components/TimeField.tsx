import { CLOCK_DIGITS, DURATION_DIGITS, nextMaskedTime } from '../domain/pace';
import { Field } from './Field';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** duration: m:ss ou h:mm:ss; clock: horário hh:mm. */
  kind?: 'duration' | 'clock';
  placeholder?: string;
  error?: string;
  fill?: boolean;
  showErrorText?: boolean;
}

/** Campo de tempo em que se digita só números; os ":" entram sozinhos. */
export function TimeField({ kind = 'duration', value, onChangeText, ...fieldProps }: Props) {
  const digits = kind === 'clock' ? CLOCK_DIGITS : DURATION_DIGITS;
  return (
    <Field
      {...fieldProps}
      value={value}
      onChangeText={(text) => onChangeText(nextMaskedTime(value, text, digits))}
      keyboardType="number-pad"
      maxLength={digits + Math.ceil(digits / 2) - 1}
    />
  );
}
