import { type Shoe, isActiveShoe } from '../domain/shoe';
import { ChoiceChips } from './ChoiceChips';

export const NO_SHOE = 'none';

interface Props {
  shoes: readonly Shoe[];
  /** Id escolhido ou NO_SHOE. */
  value: string;
  onChange: (value: string) => void;
  /** Mantém na lista o tênis já gravado no treino, mesmo aposentado. */
  keepId?: string;
}

/** Escolha do tênis do treino; some se não houver tênis cadastrados. */
export function ShoePicker({ shoes, value, onChange, keepId }: Props) {
  const options = shoes.filter((s) => isActiveShoe(s) || s.id === keepId);
  if (options.length === 0) return null;
  return (
    <ChoiceChips
      label="Tênis"
      options={[...options.map((s) => ({ value: s.id, label: s.name })), { value: NO_SHOE, label: 'Nenhum' }]}
      value={value}
      onChange={(v) => v && onChange(v)}
    />
  );
}
