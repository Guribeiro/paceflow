import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import { shoeRepository } from '../data/shoes';
import { type DistanceUnit, distanceInUnit, formatDistance, parseDistance, toKilometers } from '../domain/pace';
import { DEFAULT_SHOE_LIMIT_METERS, SHOE_NAME_MAX_LENGTH, type Shoe } from '../domain/shoe';
import { type ShoeStatus, shoeMileage, shoeStatus } from '../domain/shoe-mileage';
import { useShoes } from '../hooks/useShoes';
import { useWorkouts } from '../hooks/useWorkouts';
import { Field } from './Field';
import { Button } from './ui/Button';
import { ProgressBar } from './ui/ProgressBar';
import { SectionHeader } from './ui/SectionHeader';
import { Card } from './ui/Card';
import { ButtonRow } from './ui/ButtonRow';

const STATUS_LABEL: Record<ShoeStatus, string> = {
  ok: '',
  attention: 'Perto da troca',
  replace: 'Hora de trocar',
};

function confirmRemove(shoe: Shoe) {
  const message = 'Os treinos continuam no diário, só sem o tênis.';
  if (Platform.OS === 'web') {
    if (window.confirm(`Excluir ${shoe.name}?\n${message}`)) shoeRepository.remove(shoe.id);
    return;
  }
  Alert.alert(`Excluir ${shoe.name}?`, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => shoeRepository.remove(shoe.id) },
  ]);
}

function ShoeRow({ shoe, meters, unit }: { shoe: Shoe; meters: number; unit: DistanceUnit }) {
  const status = shoeStatus(meters, shoe.limitMeters);
  const ratio = Math.min(1, meters / shoe.limitMeters);
  const retired = shoe.retiredAt !== null;
  const summary = `${formatDistance(meters, unit)} de ${formatDistance(shoe.limitMeters, unit)} ${unit}`;

  return (
    <Card gap={2} compact>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${shoe.name}${retired ? ', aposentado' : ''}: ${summary}${STATUS_LABEL[status] ? `, ${STATUS_LABEL[status]}` : ''}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        className="gap-1"
      >
        <View className="flex-row flex-wrap items-center justify-between gap-x-3">
          <Text className="text-lg font-bold text-black dark:text-white">
            {shoe.name}
            {retired ? ' (aposentado)' : ''}
          </Text>
          {STATUS_LABEL[status] && !retired ? (
            <Text
              className={`text-base font-bold ${status === 'replace' ? 'text-red-700 dark:text-red-400' : 'text-black dark:text-white'}`}
            >
              {STATUS_LABEL[status]}
            </Text>
          ) : null}
        </View>
        <ProgressBar ratio={ratio} />
        <Text className="text-base text-neutral-700 dark:text-neutral-300">{summary}</Text>
      </View>
      <View className="flex-row flex-wrap justify-end gap-2">
        <Button
          label={retired ? 'Reativar' : 'Aposentar'}
          variant="link"
          onPress={() => shoeRepository.update(shoe.id, { retired: !retired })}
        />
        <Button label="Excluir" variant="danger-link" onPress={() => confirmRemove(shoe)} />
      </View>
    </Card>
  );
}

function AddShoeForm({ unit, onDone }: { unit: DistanceUnit; onDone: () => void }) {
  const [name, setName] = useState('');
  const [initialText, setInitialText] = useState('');
  const [limitText, setLimitText] = useState('');
  const initial = initialText ? parseDistance(initialText) : null;
  const limit = limitText ? parseDistance(limitText) : null;
  const initialOk = !initial || initial.ok;
  const limitOk = !limit || (limit.ok && limit.value > 0);
  const canSave = name.trim().length > 0 && initialOk && limitOk;
  const toMeters = (value: number) => toKilometers(value, unit) * 1000;

  function save() {
    const result = shoeRepository.create({
      name,
      initialMeters: initial?.ok ? toMeters(initial.value) : 0,
      limitMeters: limit?.ok ? toMeters(limit.value) : DEFAULT_SHOE_LIMIT_METERS,
    });
    if (result.ok) onDone();
  }

  return (
    <Card compact>
      <Field
        label="Nome do tênis"
        variant="text"
        value={name}
        onChangeText={setName}
        placeholder="Ex.: Pegasus 41"
        maxLength={SHOE_NAME_MAX_LENGTH}
        fill={false}
      />
      <Field
        label={`Já rodados (${unit}, opcional)`}
        value={initialText}
        onChangeText={setInitialText}
        placeholder="0"
        keyboardType="decimal-pad"
        error={initialOk ? undefined : 'Use um número'}
        fill={false}
      />
      <Field
        label={`Trocar com (${unit})`}
        value={limitText}
        onChangeText={setLimitText}
        placeholder={distanceInUnit(DEFAULT_SHOE_LIMIT_METERS, unit).toFixed(0)}
        keyboardType="decimal-pad"
        error={limitOk ? undefined : 'Use um número maior que zero'}
        fill={false}
      />
      <ButtonRow>
        <Button label="Cancelar" variant="secondary" grow onPress={onDone} />
        <Button label="Salvar" accessibilityLabel="Salvar tênis" grow onPress={save} disabled={!canSave} />
      </ButtonRow>
    </Card>
  );
}

/** Seção "Tênis" em Ajustes: quilometragem por par e aviso de troca. */
export function ShoesSection({ unit }: { unit: DistanceUnit }) {
  const shoes = useShoes();
  const workouts = useWorkouts();
  const [adding, setAdding] = useState(false);
  // Ativos primeiro, aposentados no fim.
  const ordered = [...shoes].sort((a, b) => Number(a.retiredAt !== null) - Number(b.retiredAt !== null));

  return (
    <View className="gap-2">
      <SectionHeader>Tênis</SectionHeader>
      {shoes.length === 0 && !adding ? (
        <Text className="text-base text-neutral-700 dark:text-neutral-300">
          Cadastre seus tênis para acompanhar quantos km cada par já rodou.
        </Text>
      ) : null}
      {ordered.map((shoe) => (
        <ShoeRow key={shoe.id} shoe={shoe} meters={shoeMileage(shoe, workouts)} unit={unit} />
      ))}
      {adding ? (
        <AddShoeForm unit={unit} onDone={() => setAdding(false)} />
      ) : (
        <Button label="Adicionar tênis" variant="link" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
