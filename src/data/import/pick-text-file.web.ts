import { getDocumentAsync } from 'expo-document-picker';

/** Na web o seletor devolve um File do navegador, lido direto. */
export async function pickTextFile(mimeTypes: string[]): Promise<string | null> {
  const result = await getDocumentAsync({ type: mimeTypes });
  if (result.canceled) return null;

  const file = result.assets[0].file;
  if (!file) throw new Error('FILE_UNAVAILABLE');
  return file.text();
}
