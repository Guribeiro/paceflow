/** Abre o seletor de arquivos do sistema e devolve o texto do arquivo, ou null se cancelado. */
export async function pickTextFile(mimeTypes: string[]): Promise<string | null> {
  // Import dinâmico pelo mesmo motivo do share-file: um build sem o módulo nativo
  // só falha ao importar, sem derrubar a tela.
  const [DocumentPicker, { File }] = await Promise.all([
    import('expo-document-picker'),
    import('expo-file-system'),
  ]);

  const result = await DocumentPicker.getDocumentAsync({ type: mimeTypes, copyToCacheDirectory: true });
  if (result.canceled) return null;

  return new File(result.assets[0].uri).text();
}
