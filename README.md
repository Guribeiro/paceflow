# PaceFlow

Calculadora de ritmo e diário de corrida para Android, feita com Expo e React Native. Funciona offline: os dados ficam no aparelho e, com login, sincronizam com o Supabase.

## Funcionalidades

- **Calculadora:** pace e velocidade a partir de distância e tempo, projeção de provas (5 km a maratona) e paces de treino. O campo de tempo tem máscara: digite `2500` e ele vira `25:00`.
- **Modo Tiros:** tempo-alvo por tiro, registro volta a volta e salvamento da série no diário.
- **Correr:** gravação da corrida com GPS, também com a tela apagada.
- **Diário:** registro e edição de treinos com terreno, esforço percebido (RPE), tênis e nota; resumo da semana e meta semanal de km.
- **Evolução:** km por semana, tendência de pace, recordes pessoais, prova-alvo com projeção e plano semana a semana.
- **Tênis:** cadastro e quilometragem por par.
- **Lembretes:** dias de treino, meta da semana e aviso 7 dias e 1 dia antes da prova.
- **Widget Android:** km da semana e último pace.
- **Backup:** exportação em CSV/JSON e importação de JSON.
- **Conta e sync:** login por código enviado por e-mail e sincronização automática de treinos, tênis e preferências.
- Tema claro/escuro, km ou milhas e layout adaptado a fonte grande.

## Stack

| Área | Tecnologia |
|---|---|
| App | Expo SDK 58, React Native 0.88, Expo Router, TypeScript |
| Estilo | NativeWind (Tailwind CSS), fonte Inter |
| Dados locais | MMKV |
| Nuvem | Supabase (Postgres com RLS, Auth por código) |
| Testes | Jest, React Native Testing Library, pgTAP |

## Estrutura

```
src/
  app/        rotas do Expo Router (cada arquivo é uma aba)
  screens/    telas
  components/ componentes de UI
  hooks/      hooks de estado e preferências
  domain/     regras puras: cálculo de pace, metas, recordes, plano de treino
  data/       repositórios MMKV, sync com o Supabase, exportação e importação
  widgets/    widget Android
supabase/     migrações, testes pgTAP, templates de e-mail e config
```

As pastas `android/` e `ios/` são geradas pelo `expo prebuild` (Continuous Native Generation) e não ficam no git. A configuração nativa fica em `app.json` e `app.config.ts`.

## Como rodar

Requisitos: Node.js e, para builds locais, JDK 17 e Android SDK. Para o banco local, Supabase CLI e Docker.

```bash
npm install
cp .env.example .env.local   # preencha as variáveis; sem elas o app funciona sem sync
```

O app usa módulos nativos que não existem no Expo Go, então precisa de um build de desenvolvimento.

```bash
npm run android:dev   # gera o APK "PaceFlow Dev"
npx expo start --dev-client
```

Também dá para gerar o build de desenvolvimento na nuvem com `npm run build:android:dev` (EAS).

### Variantes

- **PaceFlow Dev** (`APP_VARIANT=development`): pacote `com.gustavoribeiro.paceflow.dev`, para desenvolvimento.
- **PaceFlow** (`npm run android:release`): o app de uso diário, que lê o `.env.production.local` com a URL e a publishable key do projeto hospedado.

As duas variantes convivem no mesmo aparelho, cada uma com seus próprios dados.

### Supabase local

```bash
npm run db:start   # sobe o Supabase local
npm run db:reset   # recria o banco com as migrações
npm run db:test    # roda os testes pgTAP (RLS e esquema)
npm run db:types   # regenera os tipos do banco
```

`npx supabase status -o env` mostra a URL e a publishable key para o `.env.local`. Nunca use a secret/service_role key no app.

## Qualidade

```bash
npm test           # Jest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint, sem avisos
```
