# Ficha da Google Play — PaceFlow

Textos prontos para colar no Play Console. Os limites de caracteres estão entre parênteses.

## Detalhes do app

**Nome do app (30)**
PaceFlow: pace e corrida

**Descrição curta (80)**
Calcule seu pace, grave corridas com GPS e acompanhe sua evolução, sem anúncios.

**Descrição completa (4000)**

O PaceFlow é o app de corrida para quem quer entender o próprio ritmo. Ele calcula, grava e mostra a sua evolução, sem anúncios e sem exigir conta.

CALCULADORA DE PACE
• Pace, tempo ou distância: preencha dois e o PaceFlow calcula o terceiro, em km ou milhas.
• Projeção de provas: estimativa de tempo para 5 km, 10 km, meia e maratona a partir de um treino.
• Paces de treino: ritmos de rodagem, limiar, intervalado e repetição calculados pelo seu nível.
• Tiros: monte séries de intervalos e veja o ritmo de cada repetição.

CORRA COM GPS
• Grave a corrida com distância, tempo e pace em tempo real, mesmo com a tela apagada.
• Parciais a cada quilômetro ou milha.
• Avisos falados em cada parcial, para não precisar olhar o celular.
• Pausa automática: o tempo para no semáforo e volta quando você anda.
• Trajeto desenhado no fim da corrida, guardado só no seu aparelho.

DIÁRIO DE TREINOS
• Registre corridas de rua, pista ou esteira, com esforço, nota e tênis usado.
• Resumo da semana e recordes pessoais com comemoração.
• Controle da quilometragem dos tênis, com aviso na hora de trocar.

EVOLUÇÃO
• Gráfico de distância por semana e meta semanal.
• Prova-alvo com projeção de tempo e plano de volume até o dia da prova.

FEITO PARA O DIA A DIA
• Lembretes de treino no horário que você escolher.
• Widget na tela inicial com os km da semana.
• Tema claro e escuro, alto contraste para usar sob o sol e suporte à fonte grande do sistema.
• Backup em arquivo (JSON) e exportação em CSV.

SEUS DADOS SÃO SEUS
O PaceFlow funciona sem conta: os treinos ficam no seu aparelho. Se quiser, entre com o e-mail para sincronizar os treinos na nuvem, e exclua a conta quando quiser, direto no app. A localização é usada só durante a gravação e não sai do aparelho.

## Categoria e contato

- **Tipo:** app. **Categoria:** Saúde e fitness.
- **Tags:** Corrida, Fitness, Rastreador de atividade.
- **E-mail de contato:** apppaceflow@gmail.com
- **Site:** https://guribeiro.github.io/paceflow/
- **Política de privacidade:** https://guribeiro.github.io/paceflow/privacidade.html

## Conteúdo do app (rascunho das respostas)

**Anúncios:** o app não contém anúncios.

**Acesso ao app:** todas as funções estão disponíveis sem login. A conta é opcional e só serve para o sync. Se o revisor quiser testar o login, o código chega pelo e-mail informado.

**Público-alvo:** 18 anos ou mais. O app não é direcionado a crianças.

**Classificação de conteúdo (IARC):** categoria "Utilitário, produtividade, comunicação ou outro". Responda "não" a violência, conteúdo sexual, linguagem imprópria, drogas, apostas, compras e interação entre usuários. O app não tem chat, conteúdo gerado por usuários visível a terceiros nem compartilhamento de localização com outras pessoas.

**Apps de saúde:** o app tem funções de condicionamento físico (registro de atividade). Não é um dispositivo médico e não faz diagnóstico.

**Exclusão de conta:**
- URL: https://guribeiro.github.io/paceflow/excluir-conta.html
- Exclusão no app: Ajustes › Conta › Excluir conta.
- Dados apagados: e-mail, treinos, tênis e preferências da nuvem. Nada é retido.

### Segurança dos dados

- O app coleta ou compartilha dados? **Sim, coleta.** Não compartilha com terceiros.
- Os dados são criptografados em trânsito? **Sim** (HTTPS).
- O usuário pode pedir a exclusão? **Sim**, no app e pela URL acima.

| Tipo de dado | Coletado | Opcional | Finalidade |
|---|---|---|---|
| Informações pessoais › Endereço de e-mail | Sim | Sim (só com conta) | Gerenciamento da conta |
| Saúde e fitness › Informações de condicionamento físico (treinos: distância, tempo, esforço, parciais) | Sim | Sim (só com conta) | Funcionalidade do app (sync) |
| Local › Localização exata | **Não coletado.** É usada só no aparelho e nunca é transmitida, o que pela definição da Play não conta como coleta. | — | — |
| Atividade no app, identificadores, diagnósticos | Não coletados (sem análise de uso nem relatório de falhas) | — | — |

O processamento é feito pelo Supabase, que atua como prestador de serviço e, pela definição da Play, não conta como "compartilhamento".

### Serviço em primeiro plano (FOREGROUND_SERVICE_LOCATION)

- **Tipo:** location.
- **Justificativa:** "Ao tocar em Começar na aba Correr, o PaceFlow inicia um serviço em primeiro plano com uma notificação fixa para continuar medindo distância, tempo e pace pelo GPS com a tela apagada durante a corrida. O serviço para quando o usuário finaliza ou descarta a corrida. O app não acessa a localização em segundo plano fora de uma corrida iniciada pelo usuário."
- **Vídeo (até 30 s, link do YouTube não listado):** abrir a aba Correr, tocar em Começar, mostrar a notificação "PaceFlow gravando corrida", apagar a tela, reacender e finalizar.

## Arte gráfica (ainda a gerar)

- Ícone 512×512 PNG, a partir de `assets/icon.svg`.
- Gráfico de destaque 1024×500.
- Capturas do celular, de 2 a 8, em 9:16 (sugestão: Calculadora, Correr com o trajeto, Diário, Evolução, Ajustes no tema escuro). Usar dados de exemplo, nunca dados pessoais.
