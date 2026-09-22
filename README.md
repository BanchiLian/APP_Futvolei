# FutCheck

Sistema de check-in para arena de futevôlei: alunos e jogadores avulsos avisam com antecedência se
vão às aulas e aos dayuses; professores e administradores controlam a lista de presença no dia.

Uma aplicação web Vue — app mobile-first instalável como PWA e painel administrativo — sobre uma
API Node com PostgreSQL.

## Stack

| Camada   | Tecnologias                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Vue 3 (`<script setup>`), TypeScript, Vite 8, Vue Router, Pinia, Tailwind 4, VeeValidate + Zod, Axios, dayjs, vite-plugin-pwa |
| Backend  | Node 24, TypeScript, Express 5, PostgreSQL 16, Prisma 7, Zod, JWT, Argon2id, pino, helmet, express-rate-limit                 |
| Infra    | npm workspaces, Docker Compose, ESLint + Prettier, Husky + lint-staged + commitlint, Vitest + Supertest                       |

## Começando do zero

Pré-requisitos: **Node 22+**, **Docker** e **Git**.

```bash
# 1. Dependências
npm install

# 2. Ambiente — edite os segredos antes de seguir
cp .env.example .env

# 3. Client do Prisma (necessário para typecheck e testes)
npm run db:generate

# 4. Banco
npm run db:up

# 5. Migrations + dados de desenvolvimento
npm run db:migrate
npm run db:seed

# 6. Subir tudo
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3333
- Health check: http://localhost:3333/health

### O que editar no `.env` antes de rodar

| Variável                                                             | Por quê                                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`                           | Precisam ter 32+ caracteres e ser **diferentes entre si**                                                                    |
| `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD` | Credenciais do dono do sistema. Local aceita admin/admin; produção exige 12+ caracteres e a API não sobe com senha conhecida |

Gere segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

A API valida todo o `.env` com Zod na inicialização e **se recusa a subir** com qualquer valor
faltando ou malformado, apontando exatamente qual.

## Super admin

Existe **exatamente um** `SUPER_ADMIN`, o dono do sistema. Ele não pode ser criado, promovido nem
atribuído por nenhum endpoint ou tela — só pela linha de comando:

```bash
# Cria o super admin a partir de SUPER_ADMIN_* do .env.
# Idempotente: se já existir, avisa e não cria outro.
npm run superadmin:create

# Recuperação de acesso pelo servidor. Revoga todas as sessões ativas.
npm run superadmin:reset-password
```

O `npm run db:seed` chama o mesmo script. Detalhes em [`docs/permissoes.md`](docs/permissoes.md).

## Usuários do seed

Todos usam a senha de `SEED_DEFAULT_PASSWORD` (padrão: `Futcheck@2026`). O super admin usa a senha
de `SUPER_ADMIN_PASSWORD`.

| Perfil      | E-mail                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| SUPER_ADMIN | usuário `admin` (ou o e-mail de `SUPER_ADMIN_EMAIL`), senha local `admin` — a única conta administrativa |
| PROFESSOR   | `carlos.professor@futcheck.local`, `juliana.professor@futcheck.local`                                    |
| ALUNO       | `ana.aluna@`, `bruno.aluno@`, `camila.aluna@`, `diego.aluno@`, `elisa.aluna@futcheck.local`              |
| DAYUSE      | `felipe.dayuse@`, `gabriela.dayuse@`, `henrique.dayuse@futcheck.local`                                   |

O seed também cria a grade padrão — aula de segunda a quinta, dayuse de sexta a domingo — e as
configurações padrão do sistema.

## Comandos

| Comando                     | O que faz                             |
| --------------------------- | ------------------------------------- |
| `npm run dev`               | Sobe shared (watch), API e web juntos |
| `npm run build`             | Build dos três workspaces             |
| `npm test`                  | Testes de todos os workspaces         |
| `npm run typecheck`         | `tsc --noEmit` em todos               |
| `npm run lint` / `lint:fix` | ESLint                                |
| `npm run format`            | Prettier                              |
| `npm run db:up` / `db:down` | PostgreSQL no Docker                  |
| `npm run db:migrate`        | Cria e aplica uma migration           |
| `npm run db:reset`          | Derruba, recria e re-semeia o banco   |
| `npm run db:studio`         | Prisma Studio                         |
| `npm run db:generate`       | Regenera o client do Prisma           |

## Estrutura

```
futcheck/
├── apps/
│   ├── api/                 API REST
│   │   ├── prisma/          schema.prisma, migrations, seed.ts
│   │   ├── scripts/         superadmin-create.ts, superadmin-reset-password.ts
│   │   └── src/
│   │       ├── modules/     auth, users, schedules, sessions, bookings, attendance, …
│   │       ├── middlewares/ errorHandler, httpLogger, rateLimit, …
│   │       ├── lib/         prisma, logger, password, errors
│   │       ├── config/      env (validado com Zod)
│   │       ├── app.ts
│   │       └── server.ts
│   └── web/                 PWA Vue
│       └── src/             pages/ components/ composables/ stores/ services/ router/ layouts/
├── packages/
│   └── shared/              enums, permissões, schemas Zod, util de datas, códigos de erro
├── docs/                    decisions.md, permissoes.md, regras-de-negocio.md
├── docker-compose.yml
└── CLAUDE.md                convenções do projeto
```

A arquitetura da API é em camadas: `route → controller → service → repository`. Regra de negócio
nunca fica no controller nem em componente Vue.

## Documentação

- [`docs/regras-de-negocio.md`](docs/regras-de-negocio.md) — calendário, RSVP, presença, prazos
- [`docs/permissoes.md`](docs/permissoes.md) — RBAC, matriz por perfil, proteções do super admin
- [`docs/decisions.md`](docs/decisions.md) — decisões técnicas e seus porquês
- [`CLAUDE.md`](CLAUDE.md) — convenções para quem for mexer no código

## Estado

**Fases 1 e 2 concluídas. Em andamento: CTs, sessões, respostas e o app mobile.**

- [x] 1. Fundação
- [x] 2. Autenticação e RBAC
- [ ] 3. Perfil e foto
- [ ] 4. Grade e sessões
- [ ] 5. Respostas (Vou / Não vou)
- [ ] 6. Presença
- [ ] 7. Painéis admin e super admin
- [ ] 8. Polimento (PWA, acessibilidade, OpenAPI)
