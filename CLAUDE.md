# Convenções do projeto FutCheck

Instruções para sessões futuras. Leia antes de escrever código.

## O que é

Sistema de check-in para uma arena de futevôlei. Uma aplicação web Vue (app mobile-first instalável
como PWA + painel administrativo) consumindo uma API Node com PostgreSQL.

Documentos que mandam:

- [`docs/regras-de-negocio.md`](docs/regras-de-negocio.md) — calendário, RSVP, presença
- [`docs/permissoes.md`](docs/permissoes.md) — RBAC e proteções do super admin
- [`docs/decisions.md`](docs/decisions.md) — decisões técnicas e seus porquês

## Estrutura

```
apps/api      API Express + Prisma
apps/web      Vue 3 + Vite (app do usuário e painel admin)
packages/shared   enums, tipos, schemas Zod, matriz de permissões, util de datas
```

`packages/shared` é a fonte de verdade de tudo que api e web precisam concordar: enums,
permissões, códigos de erro, schemas de validação e datas.

## Arquitetura da API

A cadeia é sempre:

```
route → controller → service → repository
```

- **route** — declara o caminho e encadeia middlewares (`requirePermission`, validação).
- **controller** — só HTTP: lê a request, chama o service, devolve a response. Sem regra.
- **service** — toda a regra de negócio. Autorização também é checada aqui, não só no middleware.
- **repository** — acesso a dados via Prisma.

**Regra de negócio nunca fica no controller nem em componente Vue.**

Cada módulo em `apps/api/src/modules/<modulo>/` tem `routes`, `controller`, `service`,
`repository`, `schemas` e `*.test.ts`.

## Invariantes que não podem ser quebradas

Estas não são preferências. Quebrar uma é um bug de segurança:

1. **Nenhum endpoint, schema ou tela aceita o valor `SUPER_ADMIN`.** A role só existe via
   `npm run superadmin:create`. Há índice único parcial no banco garantindo unicidade.
2. **Cadastro público cria sempre `DAYUSE`.** `registerSchema` não tem campo `role`.
3. **O rótulo de perfil só aparece para quem tem `user:role-label:view`.** `GET /me` devolve
   `permissions` para todos e `role` só para admins.
4. **RBAC por permissão.** Nunca `if (role === ...)` fora de `packages/shared/src/permissions.ts`.
5. **Autorização também no service**, para impedir IDOR — o usuário só altera o que é dele.
6. **`password_hash` nunca sai da API.** Use `select` explícito no Prisma.
7. **Toda lógica de data passa por `packages/shared/src/date.ts`.** Nada de `new Date().getDay()`.
8. **E-mail sempre pelo `emailSchema`**, que normaliza para minúsculas — é o que torna a constraint
   única case-insensitive.
9. **Nenhum segredo commitado.** Só no `.env`, que é gitignorado.

## Estilo

- **Código, nomes, comentários e mensagens de commit em inglês. Textos de interface em português.**
- TypeScript `strict`, sem `any` sem justificativa escrita.
- ESM em todo o monorepo. Imports relativos com extensão `.js` na API (`moduleResolution: NodeNext`).
- Comentário explica **por quê**, não o quê. Se o código precisa de comentário para dizer o que faz,
  reescreva o código.
- Erros sempre no formato `{ error: { code, message, details } }`, com `code` vindo de
  `ERROR_CODES`. Cada bloqueio de negócio tem seu próprio código.

## Testes

Obrigatórios (seção 13 da especificação):

- Regras de resposta: lotação, lista de espera, prazos e bloqueios por perfil.
- Util de datas e fuso — inclusive o caso de domingo 23h30 em São Paulo.
- Geração de sessões (idempotência).
- **Pelo menos um teste de acesso negado para cada endpoint protegido.**
- Super admin: nenhum endpoint cria/atribui a role; o banco rejeita um segundo; ADMIN não vê, não
  edita, não desativa; ADMIN não cria nem promove ADMIN; o script é idempotente.
- Cadastro público: sempre DAYUSE mesmo com payload malicioso; `/me` não expõe o rótulo.
- Checklist: professor dentro e fora do prazo; admin sem prazo; walk-in com sessão lotada.

Vitest nos três workspaces, Supertest para API.

## Comandos

| Comando                             | O que faz                                         |
| ----------------------------------- | ------------------------------------------------- |
| `npm run dev`                       | Sobe shared (watch), API e web juntos             |
| `npm run db:up` / `db:down`         | PostgreSQL no Docker                              |
| `npm run db:migrate`                | Cria e aplica migration                           |
| `npm run db:seed`                   | Popula o banco de desenvolvimento                 |
| `npm run db:generate`               | Regenera o client do Prisma (após mudar o schema) |
| `npm run superadmin:create`         | Cria o super admin a partir do `.env`             |
| `npm run superadmin:reset-password` | Redefine a senha do super admin                   |
| `npm test`                          | Testes de todos os workspaces                     |
| `npm run lint` / `format`           | ESLint / Prettier                                 |
| `npm run typecheck`                 | `tsc --noEmit` em todos os workspaces             |

## Fluxo de trabalho

1. Trabalhe por fases (seção 12 da especificação) e **pare ao final de cada uma** para revisão.
2. Ao final de cada fase: lint, testes e build; atualize README e `docs/`; commit em
   Conventional Commits; entregue um resumo com o que foi feito, como testar e o que vem a seguir.
3. Para o que não estiver especificado: adote o padrão mais sensato de mercado, **registre em
   `docs/decisions.md`** e siga em frente.
4. Ao receber novos requisitos, a ordem de atualização é:
   `docs/` → matriz em `packages/shared` → implementação → testes.

## Commits

Conventional Commits, com escopo. Escopos válidos: `root`, `api`, `web`, `shared`, `db`, `docs`,
`ci`, `deps`, `auth`, `rbac`.

```
feat(api): add rsvp waitlist promotion
fix(web): keep access token out of localStorage
docs(rbac): document super admin protections
```

Hooks: `pre-commit` roda lint-staged, `commit-msg` roda commitlint.

## Estado atual

**Fases 1 (Fundação) e 2 (Autenticação e RBAC) concluídas.** Próxima: Fase 3 — Perfil e foto.

Peças de autenticação já disponíveis para as próximas fases:

- `authenticate` (middleware) resolve `req.auth = { userId, role, permissions }` relendo o usuário
  do banco a cada requisição.
- `requirePermission(...)` (middleware) é o portão de rota. **Não dispensa** a checagem de posse no
  service.
- `validateBody(schema)` valida e **substitui** o corpo pelo valor parseado, o que é o que descarta
  campos não declarados.
- `recordAudit(...)` grava na auditoria e nunca lança.
- `assertRoleIsAssignable`, `assertCanMutateUser`, `assertCanAssignRole` e
  `superAdminVisibilityFilter` em `src/lib/superAdmin.ts` — use todos ao construir o módulo de
  usuários na Fase 7.
- `USER_SAFE_SELECT` e `toMeResponse` em `src/modules/users/user.serializer.ts` são o único caminho
  pelo qual um usuário sai da API.
