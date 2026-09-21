# Permissões (RBAC)

Fonte de verdade da implementação: `packages/shared/src/permissions.ts`.
Este documento explica o **porquê**; o arquivo é o **o quê**.

## Como funciona

O controle de acesso é **baseado em permissões**, nunca em comparação de perfil espalhada pelo
código. Não existe `if (role === 'ADMIN')` na aplicação.

```
Perfil (role)  →  lista de permissões  →  verificação no ponto de uso
```

- **Backend** — `requirePermission('session:manage')` como middleware, somado a checagens de
  propriedade dentro do service (para impedir IDOR: o usuário só altera o próprio perfil e as
  próprias respostas).
- **Frontend** — `useCan()` esconde ações e o guard de rota bloqueia navegação.
- **O backend é a única fonte de verdade.** O frontend esconde; o backend recusa. Um cliente
  adulterado não ganha nada.

Adicionar uma capacidade nova = adicionar uma permissão em `PERMISSIONS` e concedê-la aos perfis
em `ROLE_PERMISSIONS`. Nada além disso muda.

## Catálogo de permissões

| Permissão                       | O que libera                                                             |
| ------------------------------- | ------------------------------------------------------------------------ |
| `profile:manage:own`            | Entrar, editar o próprio perfil, trocar foto e senha                     |
| `session:view:aula`             | Ver a agenda de aulas                                                    |
| `session:view:dayuse`           | Ver a agenda de dayuse                                                   |
| `session:rsvp:aula`             | Responder Vou/Não vou por si mesmo em uma aula                           |
| `session:rsvp:dayuse`           | Responder Vou/Não vou por si mesmo em um dayuse                          |
| `session:rsvp:on-behalf`        | Responder em nome de qualquer usuário, em qualquer tipo                  |
| `session:attendees:view:aula`   | Ver quem confirmou (nome e foto) em uma aula                             |
| `session:attendees:view:dayuse` | Ver quem confirmou (nome e foto) em um dayuse                            |
| `session:manage`                | Criar, editar e cancelar sessões                                         |
| `schedule:manage`               | CRUD da grade de horários e disparo da geração de sessões                |
| `attendance:manage:own`         | Marcar/editar presença nas sessões em que é responsável, dentro do prazo |
| `attendance:manage:any`         | Marcar/editar presença em qualquer sessão, sem prazo                     |
| `user:view:any`                 | Listar e buscar usuários                                                 |
| `user:view:own-sessions`        | Ver apenas os usuários das próprias sessões                              |
| `user:manage`                   | Criar, editar, ativar e desativar usuários                               |
| `user:role:assign:basic`        | Atribuir DAYUSE, ALUNO ou PROFESSOR                                      |
| `user:role-label:view`          | Ver o rótulo de perfil de acesso de outros usuários                      |
| `admin:manage`                  | Criar, promover, rebaixar e desativar ADMIN                              |
| `report:view:any`               | Dashboard e relatórios completos                                         |
| `report:view:own`               | Dashboard e relatórios restritos às próprias sessões                     |
| `settings:manage`               | Ler e gravar as configurações do sistema                                 |
| `audit:view`                    | Ler o log de auditoria completo                                          |

## Matriz por perfil

| Permissão                       | SUPER_ADMIN | ADMIN | PROFESSOR | ALUNO | DAYUSE |
| ------------------------------- | :---------: | :---: | :-------: | :---: | :----: |
| `profile:manage:own`            |     ✅      |  ✅   |    ✅     |  ✅   |   ✅   |
| `session:view:aula`             |     ✅      |  ✅   |    ✅     |  ✅   |   ❌   |
| `session:view:dayuse`           |     ✅      |  ✅   |    ✅     |  ✅   |   ✅   |
| `session:rsvp:aula`             |     ✅      |  ✅   |    ❌     |  ✅   |   ❌   |
| `session:rsvp:dayuse`           |     ✅      |  ✅   |    ✅     |  ✅   |   ✅   |
| `session:rsvp:on-behalf`        |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `session:attendees:view:aula`   |     ✅      |  ✅   |    ✅     |  ✅   |   ❌   |
| `session:attendees:view:dayuse` |     ✅      |  ✅   |    ✅     |  ✅   |   ✅   |
| `session:manage`                |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `schedule:manage`               |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `attendance:manage:own`         |     ❌²     |  ❌²  |    ✅     |  ❌   |   ❌   |
| `attendance:manage:any`         |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `user:view:any`                 |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `user:view:own-sessions`        |     ❌³     |  ❌³  |    ✅     |  ❌   |   ❌   |
| `user:manage`                   |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `user:role:assign:basic`        |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `user:role-label:view`          |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `admin:manage`                  |     ✅      |  ❌   |    ❌     |  ❌   |   ❌   |
| `report:view:any`               |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `report:view:own`               |     ❌³     |  ❌³  |    ✅     |  ❌   |   ❌   |
| `settings:manage`               |     ✅      |  ✅   |    ❌     |  ❌   |   ❌   |
| `audit:view`                    |     ✅      |  ❌   |    ❌     |  ❌   |   ❌   |

¹ O admin **joga como usuário normal**: responde Vou/Não vou por si mesmo nas duas agendas, e além
disso responde em nome de qualquer outra pessoa (`session:rsvp:on-behalf`). As duas coisas são
permissões separadas de propósito — tirar as pessoais transforma o admin em staff puro sem mexer
nos poderes de gestão. Ver [ADR-18](decisions.md#adr-18--admin-tambem-joga-como-usuario-normal).

² `attendance:manage:any` é um superconjunto de `attendance:manage:own`: o admin edita qualquer
lista, sem prazo. Conceder as duas seria redundante.

³ Idem: `user:view:any` e `report:view:any` cobrem as versões restritas.

## Perfis do usuário final

O usuário **nunca vê** o rótulo do próprio perfil de acesso. Nem no app, nem em `/me`.

- `GET /me` devolve `permissions` para todo mundo, e só inclui `role` para quem tem
  `user:role-label:view`.
- O app decide o que mostrar a partir das permissões efetivas. Um usuário DAYUSE simplesmente não
  recebe a agenda de aulas; nada na interface diz "você é dayuse".
- O rótulo (Dayuse, Aluno, Professor, Admin) aparece **só** na gestão de usuários do painel admin.

## Cadastro público

- `POST /auth/register` cria **sempre** com `PUBLIC_SIGNUP_ROLE = DAYUSE`.
- O `registerSchema` não tem campo `role`, e `z.object` descarta chaves desconhecidas: um payload
  com `role: "ADMIN"` é silenciosamente ignorado. Há teste para isso.
- Nenhuma tela ou texto do cadastro menciona "aluno".
- O painel admin tem o filtro "Novos cadastros" para revisar quem entrou e promover a ALUNO.

## Quem pode mudar o perfil de quem

| Ator        | Pode atribuir                   |
| ----------- | ------------------------------- |
| ADMIN       | DAYUSE, ALUNO, PROFESSOR        |
| SUPER_ADMIN | DAYUSE, ALUNO, PROFESSOR, ADMIN |
| Qualquer um | **nunca** SUPER_ADMIN           |

Em código: `ADMIN_ASSIGNABLE_ROLES`, `SUPER_ADMIN_ASSIGNABLE_ROLES` e `ASSIGNABLE_ROLES` — nenhuma
delas contém `SUPER_ADMIN`, e há teste garantindo isso.

## Proteções do super admin

Existe **exatamente um** `SUPER_ADMIN`, garantido em três camadas independentes:

1. **Banco** — índice único parcial `users_one_super_admin_key`, criado em SQL puro na migration
   (`CREATE UNIQUE INDEX ... WHERE role = 'SUPER_ADMIN'`). O Prisma não gera índice parcial. Uma
   segunda tentativa de inserção falha mesmo numa corrida.
2. **Schemas** — nenhum schema de entrada aceita o valor `SUPER_ADMIN`. A role não é atribuível,
   promovível nem criável pela aplicação.
3. **Services** — ninguém além dele mesmo edita, rebaixa, desativa ou exclui o super admin.
   Qualquer tentativa retorna 403 com `SUPER_ADMIN_PROTECTED` e gera registro de auditoria.

Além disso:

- **Criação** — apenas `npm run superadmin:create`, lendo `SUPER_ADMIN_*` do `.env`. O script é
  idempotente: se já existe super admin, ele informa e sai sem criar outro. É o **único** caminho
  de código do projeto que escreve `role: SUPER_ADMIN`.
- **Visibilidade** — oculto de listagens, buscas e relatórios para todos os outros perfis,
  inclusive ADMIN.
- **Senha** — mínimo de 12 caracteres (`superAdminPasswordSchema`).
- **Recuperação** — `npm run superadmin:reset-password`, executável só por quem tem acesso ao
  servidor. Revoga todas as sessões ativas.
- **Auditoria** — todas as ações do super admin vão para `audit_logs`.
- **Futuro** — a estrutura está preparada para 2FA (TOTP), sem implementação nesta fase.
