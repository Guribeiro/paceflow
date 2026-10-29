const UTI_BY_MIME: Record<string, string> = {
  'text/csv': 'public.comma-separated-values-text',
  'application/json': 'public.json',
};

/** Grava o arquivo no cache do app e abre o menu de compartilhar do sistema. */
export async function shareFile(name: string, content: string, mimeType: string): Promise<void> {
  // Import dinâmico: esses pacotes lançam erro ao carregar se o módulo nativo não
  // estiver no build. Assim um APK antigo só falha ao exportar, sem derrubar a tela.
  const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);

  if (!(await Sharing.isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);

  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: UTI_BY_MIME[mimeType],
    dialogTitle: 'Exportar treinos',
  });
}
