import { useState } from 'react';
import { Text, View } from 'react-native';

import { deleteAccount, isCloudConfigured, sendLoginCode, signOut, syncNow, verifyLoginCode } from '../data/cloud';
import type { LastSync } from '../data/sync/sync-state';
import { useAccountEmail, useLastSync } from '../hooks/useAccount';
import { Field } from './Field';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { confirmDestructive } from './ui/confirm';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function describeLastSync(last: LastSync | null, now: Date = new Date()): string {
  if (!last) return 'Ainda não sincronizado.';
  if (last.error) return `A última sincronização falhou: ${last.error}`;
  const at = new Date(last.at);
  const sameDay = at.toDateString() === now.toDateString();
  return `Última sincronização: ${sameDay ? 'hoje' : dateFormatter.format(at)} às ${timeFormatter.format(at)}.`;
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = email.trim().toLowerCase();

  async function requestCode() {
    setBusy(true);
    setError(null);
    const result = await sendLoginCode(trimmedEmail);
    setBusy(false);
    if (result.ok) setStep('code');
    else setError('Não foi possível enviar o código. Confira o e-mail e a conexão.');
  }

  async function confirmCode() {
    setBusy(true);
    setError(null);
    const result = await verifyLoginCode(trimmedEmail, code.trim());
    setBusy(false);
    if (!result.ok) setError('Código inválido ou expirado.');
  }

  if (step === 'email') {
    return (
      <View className="gap-3">
        <Text className="text-base text-muted dark:text-muted-dark">
          Opcional: entre com seu e-mail para guardar os treinos na nuvem e usá-los em outros aparelhos.
        </Text>
        <Field
          label="E-mail"
          variant="text"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="voce@exemplo.com"
          error={error ?? undefined}
          fill={false}
        />
        <Button
          label={busy ? 'Enviando…' : 'Enviar código'}
          onPress={requestCode}
          disabled={busy || !EMAIL_PATTERN.test(trimmedEmail)}
          busy={busy}
        />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-base text-muted dark:text-muted-dark">
        Enviamos um código de 6 dígitos para {trimmedEmail}.
      </Text>
      <Field
        label="Código"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="123456"
        error={error ?? undefined}
        fill={false}
      />
      <Button
        label={busy ? 'Entrando…' : 'Entrar'}
        onPress={confirmCode}
        disabled={busy || code.length !== 6}
        busy={busy}
      />
      <Button
        label="Usar outro e-mail"
        variant="secondary"
        onPress={() => {
          setStep('email');
          setCode('');
          setError(null);
        }}
        disabled={busy}
      />
    </View>
  );
}

function SignedIn({ email }: { email: string }) {
  const lastSync = useLastSync();
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const failed = Boolean(lastSync?.error);

  async function remove() {
    setBusy(true);
    setDeleteError(null);
    // Uma exceção (rede caiu no meio) conta como falha: o botão não pode ficar travado.
    const result = await deleteAccount().catch(() => ({ ok: false }));
    // Deu certo: a sessão sai e esta parte da tela desmonta.
    if (!result.ok) {
      setDeleteError('Não foi possível excluir a conta. Confira a internet e tente de novo.');
      setBusy(false);
    }
  }

  function confirmDelete() {
    confirmDestructive({
      title: 'Excluir conta?',
      message:
        'A conta e os treinos, tênis e preferências guardados na nuvem serão apagados. O que está neste aparelho continua aqui.',
      confirmLabel: 'Excluir conta',
      onConfirm: () => void remove(),
    });
  }

  async function sync() {
    setBusy(true);
    await syncNow();
    setBusy(false);
  }

  return (
    <View className="gap-3">
      <Text className="text-base text-ink dark:text-ink-dark">
        Conectado como <Text className="font-bold">{email}</Text>
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        className={`text-base font-semibold ${failed ? 'text-red-700 dark:text-red-400' : 'text-muted dark:text-muted-dark'}`}
      >
        {describeLastSync(lastSync)}
      </Text>
      <Button label={busy ? 'Sincronizando…' : 'Sincronizar agora'} onPress={sync} disabled={busy} busy={busy} />
      <Button label="Sair" variant="secondary" onPress={() => void signOut()} disabled={busy} />
      <Button label="Excluir conta" variant="danger-link" onPress={confirmDelete} disabled={busy} />
      {deleteError ? (
        <Text accessibilityLiveRegion="polite" className="text-base font-semibold text-red-700 dark:text-red-400">
          {deleteError}
        </Text>
      ) : null}
    </View>
  );
}

/** Conta opcional para backup na nuvem; some se o app foi gerado sem Supabase. */
export function AccountSection() {
  const email = useAccountEmail();
  if (!isCloudConfigured || email === undefined) return null;

  return (
    <Card title="Conta e backup na nuvem" icon="person">
      {email ? <SignedIn email={email} /> : <SignInForm />}
    </Card>
  );
}
