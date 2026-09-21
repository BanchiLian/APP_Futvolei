# Decisões técnicas

Registro das escolhas que não estavam definidas na especificação, ou em que houve motivo para
divergir dela. Cada entrada traz o contexto, a decisão e o que ela implica.

Formato: as decisões são imutáveis. Se uma for revista, a entrada antiga ganha o status
`Substituída por ADR-XX` e uma nova é escrita.

---

## ADR-01 — Node.js 24 LTS no lugar do Node 20

**Contexto.** A especificação pede Node.js 20 LTS. O Node 20 chegou ao fim de vida em abril de
2026 e não recebe mais correções de segurança.

**Decisão.** Usar Node 24 LTS (LTS ativo, com suporte até outubro de 2028). O `package.json`
declara `engines.node >= 22` e o `.npmrc` usa `engine-strict=true`.

**Consequência.** Um runtime com patches de segurança. Nenhuma dependência do projeto exige
Node 20. Se houver motivo para voltar ao 20, basta trocar `engines` — nada no código depende de
API exclusiva do 24.

---

## ADR-02 — Prisma 7 com driver adapter, e CLI fixado na versão 7

**Contexto.** O `latest` do pacote `prisma` no npm aponta hoje para `8.0.0-rc.15`, um release
candidate, enquanto o `@prisma/client` estável é o `7.10.0`. Instalar sem fixar produz um CLI RC
conversando com um client estável.

**Decisão.** Fixar `prisma` e `@prisma/client` em `^7.10.0`. O Prisma 7 usa o query compiler por
padrão, que exige um driver adapter: adotamos `@prisma/adapter-pg` sobre o `pg`.

**Consequência.** A conexão é construída em `src/lib/prisma.ts` com `new PrismaPg(...)`, e não mais
pela URL declarada no `schema.prisma`. Não usar `prisma@latest` sem conferir se ainda é RC.

---

## ADR-03 — Configuração do Prisma em `prisma.config.ts`

**Contexto.** O Prisma 7 tirou a URL do datasource do `schema.prisma` e removeu a chave `prisma`
do `package.json`.

**Decisão.** `apps/api/prisma.config.ts` é a configuração oficial. Ele carrega o `.env` da raiz do
monorepo via `dotenv` e declara `schema`, `migrations.path` e `migrations.seed`.

**Consequência.** Existe um único `.env`, na raiz, lido pela API, pelo Prisma CLI, pelo Vite e pelo
Docker Compose. Não criar `.env` dentro de `apps/`.

A URL é lida com `process.env['DATABASE_URL']`, e não pelo helper `env()` do Prisma: o `env()`
resolve de forma ansiosa e faz `prisma generate` falhar quando ainda não existe `.env`. Gerar o
client precisa funcionar num clone novo e em CI antes de os segredos serem injetados — os comandos
que de fato precisam de conexão (`migrate`, `studio`) falham sozinhos se a URL estiver faltando.

---

## ADR-04 — Zod 3.25 em todo o monorepo, e não Zod 4

**Contexto.** A stack obrigatória inclui VeeValidate + Zod. O adapter oficial `@vee-validate/zod`
(4.15.1, a versão mais recente) declara `peerDependencies: { zod: "^3.24.0" }` e não suporta Zod 4.
O `vee-validate` também ainda não aceita Standard Schema, que seria o caminho alternativo.

**Decisão.** Padronizar `zod@^3.25.76` em `shared`, `api` e `web`.

**Consequência.** Uma única versão de Zod no monorepo, o que é o que permite `packages/shared`
exportar schemas usados pelos dois lados. **Gatilho de upgrade:** quando `@vee-validate/zod`
publicar suporte a Zod 4 (ou o `vee-validate` adotar Standard Schema), subir os três workspaces
juntos, num único commit.

---

## ADR-05 — `@node-rs/argon2` como implementação do Argon2

**Contexto.** A especificação pede argon2 para hash de senha. O pacote `argon2` compila via
`node-gyp`/`prebuild-install` num script de instalação. O npm 11 passou a bloquear scripts de
instalação por padrão (`allow-scripts`), e no Windows sem Build Tools a instalação falha.

**Decisão.** Usar `@node-rs/argon2`, um binding Rust distribuído como binário pré-compilado por
plataforma, sem script de instalação.

**Consequência.** Mesmo algoritmo (Argon2id) com os parâmetros recomendados pela OWASP
(19 MiB, 2 iterações, 1 lane), e `npm install` funciona em qualquer máquina sem toolchain nativo.
O `Algorithm` do pacote é um _ambient const enum_, incompatível com `verbatimModuleSyntax`, então
a constante `Argon2id = 2` está inline em `src/lib/password.ts` — e `password.test.ts` verifica que
o hash gerado começa com `$argon2id$`, para que um valor errado falhe imediatamente.

---

## ADR-06 — Horários da grade como `VARCHAR(5)` no formato `HH:mm`

**Contexto.** `schedule_templates` guarda início e fim como hora de parede, sem data. O tipo `time`
do Postgres vira um `Date` com data fictícia no Prisma, o que é desconfortável de manipular.

**Decisão.** Guardar `start_time` e `end_time` como `VARCHAR(5)` no formato `HH:mm`, com CHECK
constraint de formato na migration.

**Consequência.** O tipo é `string` de ponta a ponta e alimenta diretamente
`businessDateTime(dateKey, time)`, que é a única função que transforma hora local em instante UTC.

---

## ADR-07 — E-mail case-insensitive por normalização na escrita

**Contexto.** A especificação pede e-mail único e case-insensitive. As opções eram a extensão
`citext`, um índice único funcional sobre `lower(email)`, ou normalizar na escrita.

**Decisão.** O `emailSchema` de `packages/shared` faz `.trim().toLowerCase()`, e todo ponto de
entrada (registro, login, criação por admin, scripts) usa esse schema. A coluna tem `@unique`.

**Consequência.** O `findUnique({ where: { email } })` do Prisma continua funcionando, sem extensão
de banco. **Invariante a preservar:** nenhum código pode escrever `email` sem passar pelo
`emailSchema`.

---

## ADR-08 — UUID v7 como chave primária

**Contexto.** UUID v4 é aleatório e espalha as inserções pelo índice B-tree.

**Decisão.** `@default(uuid(7))` em todas as tabelas.

**Consequência.** Ids ordenáveis por tempo de criação, com melhor localidade de índice, mantendo a
opacidade de um UUID.

---

## ADR-09 — Geração de sessões idempotente por constraint, não por consulta

**Contexto.** O job diário gera as sessões das próximas semanas e não pode duplicar nada.

**Decisão.** `@@unique([templateId, startsAt])` na tabela `sessions`.

**Consequência.** A idempotência é garantida pelo banco, não por um `findFirst` sujeito a corrida.
O Postgres trata `NULL` como distinto em índices únicos, então sessões avulsas
(`template_id IS NULL`) não são afetadas.

---

## ADR-10 — `/health` (liveness) separado de `/health/ready` (readiness)

**Contexto.** A especificação pede `GET /health`. Um health check que consulta o banco faz um
orquestrador matar uma API saudável durante uma indisponibilidade do Postgres.

**Decisão.** `GET /health` responde sem tocar no banco. `GET /health/ready` consulta o banco e
responde 503 quando ele está fora.

**Consequência.** Liveness e readiness podem ser apontados para endpoints diferentes no deploy.

---

## ADR-11 — ADMIN responde RSVP apenas "em nome de"

**Contexto.** A matriz da seção 4.3 diz, para ADMIN e SUPER_ADMIN, "em nome de qualquer um" — e não
"sim" — nas linhas de Vou/Não vou.

**Decisão.** ADMIN e SUPER_ADMIN recebem `session:rsvp:on-behalf`, e não
`session:rsvp:aula`/`session:rsvp:dayuse`.

**Consequência.** Um admin que queira responder por si mesmo usa
`PUT /sessions/:id/rsvp/:userId` com o próprio id. Se a intenção for que o admin também apareça na
agenda como jogador comum, basta acrescentar as duas permissões à lista dele em
`packages/shared/src/permissions.ts` — só isso.

---

## ADR-12 — Access token só em memória

**Contexto.** Guardar o access token em `localStorage` o expõe a qualquer XSS.

**Decisão.** O access token vive apenas no store Pinia, em memória. A continuidade entre recargas
vem do refresh token em cookie httpOnly, via `bootstrap()`.

**Consequência.** Um F5 dispara `POST /auth/refresh` antes da primeira navegação. O guard de rota
espera esse bootstrap terminar.

---

## ADR-13 — Client do Prisma gerado dentro de `src/`

**Contexto.** O generator `prisma-client` do Prisma 7 emite TypeScript (não JavaScript compilado) e
importa os próprios módulos com extensão `.ts` explícita.

**Decisão.** `output = "../src/generated/prisma"`, e o `tsconfig` da API habilita
`allowImportingTsExtensions` + `rewriteRelativeImportExtensions`.

**Consequência.** O `tsc` compila o client junto com o resto e reescreve as extensões no emit. A
pasta é ignorada pelo git, pelo ESLint e pelo Prettier — é código gerado. Rodar
`npm run db:generate` depois de qualquer mudança no schema.

---

## ADR-14 — Tailwind 4 com configuração em CSS

**Contexto.** O Tailwind 4 substituiu o `tailwind.config.js` por configuração em CSS.

**Decisão.** Plugin `@tailwindcss/vite` e tokens declarados em `@theme`, dentro de
`apps/web/src/styles/main.css`.

**Consequência.** Não existe `tailwind.config.js`. As famílias de cor `aula-*` (índigo) e
`dayuse-*` (âmbar) são tokens de design — é o que sustenta a exigência da seção 5 de diferenciar
os dois tipos de dia visualmente, e não só por rótulo.

---

## ADR-15 — Ícones do PWA em SVG nesta fase

**Contexto.** O manifest do PWA precisa de ícones. Gerar o conjunto PNG (192/512/maskable) é
trabalho da Fase 8.

**Decisão.** Um único `public/icon.svg` referenciado com `sizes: "any"`.

**Consequência.** O app já é instalável em navegadores que aceitam ícone SVG. A Fase 8 acrescenta o
conjunto PNG e o ícone maskable.

---

## ADR-16 — TypeScript 6 e ESLint 10

**Contexto.** São as versões correntes no momento da Fase 1.

**Decisão.** Adotar as duas. O `baseUrl` foi removido do `tsconfig` do web porque o TypeScript 6 o
deprecou; desde o TS 5, `paths` resolve relativo ao próprio arquivo.

**Consequência.** `strict` completo, mais `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters` e `verbatimModuleSyntax`. ESLint em flat config (`eslint.config.js`).

---

## ADR-17 — `.env` carregado pela própria aplicação, e `node --watch` no lugar de `tsx watch`

**Contexto.** O `npm run dev` da raiz subia o web, mas a API ficava em silêncio e nunca escutava a
porta — sem erro nenhum no log. Isoladamente, o mesmo comando funcionava em 6 segundos. A cadeia
tinha quatro processos aninhados: `concurrently` → `npm run dev -w` → `dotenv-cli` → `tsx watch`. O
watcher do `tsx` roda a aplicação num processo filho e, nesse aninhamento sem TTY no Windows, o
filho nunca subia e a falha era engolida.

**Decisão.** Duas mudanças:

1. O `.env` da raiz é carregado **dentro** de `src/config/env.ts`, com `dotenv`, e não mais por um
   wrapper `dotenv-cli` em cada script npm. A dependência `dotenv-cli` foi removida.
2. O script de desenvolvimento da API usa `node --watch --import tsx`, o watcher nativo do Node, em
   vez de `tsx watch`.

**Consequência.** `npm run dev` sobe API e web em cerca de 5 segundos. A API passa a se comportar da
mesma forma em qualquer forma de execução — `tsx`, `node dist`, seed, scripts ou runner de testes —
porque o carregamento do ambiente deixou de depender de como o processo foi iniciado.

O `dotenv` virou dependência de runtime (e não de desenvolvimento), já que `dist/server.js` também
passa por esse caminho. Arquivo ausente é no-op, que é o comportamento correto em produção, onde o
ambiente é injetado. E como o `dotenv` nunca sobrescreve variável já existente, os valores do
Vitest e de CI continuam prevalecendo.
