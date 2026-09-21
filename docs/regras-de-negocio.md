# Regras de negócio

## Glossário

| Termo                   | Significado                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| **Aula**                | Sessão com professor. Na grade padrão, de segunda a quinta.                   |
| **Dayuse**              | Sessão de jogo livre. Na grade padrão, sexta, sábado e domingo.               |
| **Sessão**              | Ocorrência concreta de uma aula ou dayuse, em data e horário definidos.       |
| **Resposta (RSVP)**     | O usuário marca "Vou" ou "Não vou" para uma sessão futura.                    |
| **Check-in / presença** | Confirmação de que a pessoa **compareceu**. Conceito distinto da resposta.    |
| **Checklist**           | Lista editável de uma sessão, onde professor/admin marcam PRESENTE ou FALTOU. |
| **Walk-in**             | Quem apareceu sem ter confirmado. Entra direto como PRESENTE.                 |

**Resposta ≠ presença.** Um "Vou" é intenção; presença é fato. O "Não vou" explícito é registrado
justamente para o professor distinguir quem recusou de quem não respondeu.

## Calendário

A grade **não é regra de código**. Não existe `if (diaDaSemana)` em lugar nenhum.

- `schedule_templates` guarda tipo, dia da semana (0=domingo … 6=sábado), início, fim, capacidade,
  responsável, título e ativo.
- O responsável é **obrigatório para AULA** e opcional para DAYUSE (CHECK constraint na migration).
- O seed cria a grade padrão (seg–qui aula, sex–dom dayuse). ADMIN e SUPER_ADMIN editam pelo painel.

### Geração de sessões

- Um job diário — que o admin também dispara manualmente — materializa as sessões das próximas
  `sessions.generationWeeksAhead` semanas (padrão: 4) a partir da grade ativa.
- **Idempotente por constraint**, não por consulta: `UNIQUE (template_id, starts_at)`. Rodar duas
  vezes não duplica nada, mesmo em paralelo.
- Alterações na grade valem para sessões ainda não geradas. O admin pode optar por reaplicar às
  futuras que ainda não têm respostas.

### Exceções

- **Sessão avulsa** — o admin cria uma sessão sem template (ex.: aulão em feriado). Como o Postgres
  trata `NULL` como distinto em índice único, ela não conflita com a geração.
- **Cancelamento** — o admin cancela uma sessão informando o motivo. As respostas dessa sessão
  passam para `CANCELADA_PELA_ARENA`, preservando o histórico.

### Fuso horário

- O fuso de negócio é `America/Sao_Paulo`, configurável por `BUSINESS_TIMEZONE`.
- Instantes são gravados como `timestamptz` (UTC).
- **Toda** lógica de "hoje", "dia da semana", "fim do dia" e prazos passa por
  `packages/shared/src/date.ts`. Nenhum outro módulo chama os helpers de timezone do dayjs.
- Caso de borda coberto por teste: domingo às 23h30 em São Paulo é **segunda-feira em UTC**. Para a
  arena, continua sendo domingo — e é o domingo que vale para a grade e para o prazo do professor.

## Respostas (RSVP)

### Parâmetros configuráveis

Ficam na tabela `settings` e são editáveis pelo admin. Definidos em
`packages/shared/src/settings.ts`.

| Chave                                    | Padrão  | O que faz                                         |
| ---------------------------------------- | ------- | ------------------------------------------------- |
| `rsvp.windowOpensDaysBefore`             | 7       | Quantos dias antes a janela de resposta abre      |
| `rsvp.changeDeadlineMinutesBefore`       | 120     | Prazo para mudar "Vou" → "Não vou" (2h antes)     |
| `attendance.checkInOpensMinutesBefore`   | 30      | Quando a checklist do professor libera            |
| `attendance.professorEditsUntilEndOfDay` | `true`  | Professor edita até 23h59 do dia da sessão        |
| `attendance.selfCheckInEnabled`          | `false` | Flag do auto check-in pelo usuário                |
| `attendance.selfCheckInWindowMinutes`    | 30      | Janela do auto check-in, antes e depois do início |
| `sessions.generationWeeksAhead`          | 4       | Semanas de sessões geradas com antecedência       |

### Status da resposta

`CONFIRMADA`, `NAO_VOU`, `LISTA_ESPERA`, `CANCELADA_PELA_ARENA`, `PRESENTE`, `FALTOU`.

Ocupam vaga contra a capacidade: `CONFIRMADA`, `PRESENTE` e `FALTOU` (`SEAT_TAKING_STATUSES`).
`FALTOU` continua ocupando porque a vaga foi de fato reservada e perdida.

### Vagas e lista de espera

- A capacidade é definida **por sessão** (copiada do template na geração, editável depois).
- Sessão lotada: "Vou" entra como `LISTA_ESPERA` com uma posição.
- Quando alguém muda para "Não vou", o primeiro da fila é promovido automaticamente.

### Uma resposta por usuário

- `UNIQUE (session_id, user_id)`.
- O endpoint de resposta é um `PUT` idempotente: reenviar a mesma resposta não muda nada.

### Bloqueios

Cada recusa tem um código próprio, para o front explicar o motivo em vez de mostrar erro genérico:

| Situação                     | Código                          |
| ---------------------------- | ------------------------------- |
| Janela ainda não abriu       | `RSVP_WINDOW_NOT_OPEN`          |
| Prazo de alteração encerrado | `RSVP_DEADLINE_PASSED`          |
| Sessão já aconteceu          | `RSVP_SESSION_IN_PAST`          |
| Sessão cancelada             | `RSVP_SESSION_CANCELLED`        |
| Tipo não permitido ao perfil | `RSVP_SESSION_TYPE_NOT_ALLOWED` |
| Sessão lotada                | `RSVP_SESSION_FULL`             |

### Concorrência

A checagem de vagas e a gravação acontecem **na mesma transação**, com `SELECT ... FOR UPDATE` na
linha da sessão. Sem isso, duas respostas simultâneas para a última vaga produziriam overbooking.
Há teste disparando respostas concorrentes para a última vaga.

## Presença (checklist)

- Libera `attendance.checkInOpensMinutesBefore` minutos antes do início.
- O professor marca, desmarca e alterna entre PRESENTE e FALTOU quantas vezes precisar, **dentro do
  prazo**: até 23h59 do dia da sessão, no fuso de negócio. Depois disso, só ADMIN e SUPER_ADMIN.
- ADMIN e SUPER_ADMIN editam qualquer checklist, **sem prazo**.
- **Walk-in** — o professor adiciona quem apareceu sem confirmar. Entra direto como `PRESENTE`,
  **mesmo com a sessão lotada**, sinalizado com `is_walk_in = true`. A realidade da quadra manda.
- Cada alteração grava `checked_in_by` e `checked_in_at`, e gera entrada na auditoria.
- **Auto check-in** pelo usuário fica atrás da flag `attendance.selfCheckInEnabled` (desligada por
  padrão), com janela de 30 minutos antes a 30 depois do início.
- Um job no fim do dia marca como `FALTOU` quem ficou `CONFIRMADA` sem presença registrada. Isso
  continua editável por ADMIN e SUPER_ADMIN.

## Contas

- Cadastro público cria sempre `DAYUSE`. Ver [permissoes.md](permissoes.md).
- Usuário desativado não faz login nem responde a sessões, mas **o histórico é preservado**.
- LGPD:
  - A data de aceite dos termos é registrada (`terms_accepted_at`).
  - O usuário pode solicitar exclusão da conta: os dados são anonimizados e as estatísticas
    permanecem.
  - De outros usuários, a aplicação expõe **apenas nome e foto** (`PublicUserSummary`).
