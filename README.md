# FutCheck

Sistema de check-in para uma rede de centros de treinamento (CTs) de futevôlei.

Quem joga avisa com antecedência se vai à aula ou ao dayuse; quem dá aula marca a presença na
quadra; quem é dono do CT cuida da grade, da equipe e das sessões. Tudo num app mobile-first
instalável como PWA.

**[Ver o app funcionando →](https://banchilian.github.io/APP_Futvolei/)**
Entre com qualquer usuário e senha. É uma demonstração com dados de exemplo, servida pelo GitHub
Pages — não há servidor por trás, então nada é salvo.

---

## O que já funciona

### Para quem joga

|                     |                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Agenda**          | A semana do CT, com filtro por Aula e Dayuse. Confirma presença num toque.           |
| **Lista de espera** | Quando a sessão lota, entra na fila e é promovido automaticamente se alguém desiste. |
| **CTs**             | 90 centros de treinamento, ordenados pela distância real de onde você está.          |
| **Feed**            | Fotos dos treinos, no estilo Instagram: curtir com toque duplo, publicar do celular. |
| **Pessoas**         | Quem mais joga na rede, com nome, foto e nível. Dá para sair da lista no perfil.     |
| **Perfil**          | Dados, foto (com EXIF removido no servidor) e troca de senha.                        |

### Para quem dá aula

A **lista de presença**, desenhada para o uso real: de pé na areia, uma mão, sol na tela. Três
alvos grandes por pessoa, totais que reagem antes de salvar, e um único salvar no fim. As marcas
são absolutas, então sinal ruim de arena não conta ninguém duas vezes. Quem chegou sem avisar entra
na lista mesmo com a sessão lotada.

### Para quem é dono do CT

| Tela                | O que faz                                                                      |
| ------------------- | ------------------------------------------------------------------------------ |
| **Meu CT**          | Nome, endereço, coordenadas, telefone, Instagram.                              |
| **Grade**           | Os horários que se repetem toda semana. As sessões são geradas a partir daqui. |
| **Equipe**          | Quem manda neste CT: donos e professores.                                      |
| **Cancelar sessão** | Com motivo. Quem ia é avisado e ninguém fica marcado como faltante.            |

### Para o super administrador

A **rede** inteira (buscar e criar CT, entregando-o a um dono), o **log de auditoria** e as
**configurações do sistema** — prazos de confirmação, janela da lista de presença, geração de
sessões.

---

## Como a autorização funciona

Esta é a parte que define o produto, então vale explicar.

O FutCheck é uma **rede** de CTs, não uma arena. Por isso a autoridade sobre um CT **não vem do
papel da conta**, e sim de um vínculo com aquele CT:

|                 | Manda em                                         | Não alcança                                         |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| **Dono do CT**  | grade, sessões, presença e equipe **do CT dele** | contas, configurações, auditoria, qualquer outro CT |
| **Professor**   | presença das sessões pelas quais responde        | grade, equipe, sessões de outros                    |
| **Super admin** | tudo, em todos os CTs, sem precisar de vínculo   | —                                                   |

A checagem acontece em **duas camadas**, e as duas são necessárias:

1. A **rota** pergunta _"essa conta poderia fazer isso em algum lugar?"_ — mantém jogador fora.
2. O **service** pergunta _"pode aqui?"_ — porque só ele sabe a qual CT uma sessão pertence. É isso
   que impede o professor de um CT alcançar a folha de presença de outro.

Nunca se escreve `if (role === ...)`: existem 29 permissões em
[`packages/shared/src/permissions.ts`](packages/shared/src/permissions.ts), que é a única fonte da
verdade. O app usa essa matriz para **esconder** ações; a API usa para **recusá-las**.

---

## Stack

| Camada    | Tecnologias                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| **Front** | Vue 3 (`<script setup>`), TypeScript, Vite 8, Vue Router 5, Pinia, Tailwind 4, VeeValidate + Zod, vite-plugin-pwa |
| **API**   | Node 24, Express 5, Prisma 7, PostgreSQL 16, Zod, JWT (jose), Argon2id, pino, helmet, express-rate-limit          |
| **Infra** | npm workspaces, ESLint + Prettier, Husky + lint-staged + commitlint, Vitest + Supertest                           |

**264 testes** passando: 73 no pacote compartilhado, 167 na API, 24 no app.

---

## Rodando do zero

Pré-requisitos: **Node 22+**, **PostgreSQL 16** (ou Docker) e **Git**.

```bash
npm install

# Copie o ambiente e edite os segredos antes de seguir
cp .env.example .env

npm run db:generate   # client do Prisma (necessário para typecheck e testes)
npm run db:up         # sobe o Postgres via Docker; pule se já tiver um local
npm run db:migrate    # aplica as migrations
npm run db:seed       # dados de desenvolvimento

npm run dev           # app em :5173, API em :3333
```

O que editar no `.env` antes de rodar:

| Variável                                   | Por quê                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` | 32+ caracteres e **diferentes entre si**                                                                                           |
| `SUPER_ADMIN_*`                            | O dono do sistema. Local aceita qualquer senha; em produção exige 12+ caracteres e a API se recusa a subir com uma senha conhecida |

### Usuários do seed

Senha padrão: `Futcheck@2026`

| Usuário                            | Papel                |
| ---------------------------------- | -------------------- |
| `carlos.professor@futcheck.local`  | Dono do CT principal |
| `juliana.professor@futcheck.local` | Professora           |
| `ana.aluna@futcheck.local`         | Aluna                |
| `joao.dayuse@futcheck.local`       | Jogador de dayuse    |

O super administrador é criado a partir do `.env`:

```bash
npm run superadmin:create          # idempotente: se já existir, avisa e não cria outro
npm run superadmin:reset-password  # recuperação pelo servidor; revoga todos os acessos
```

---

## Os CTs são reais

Os 90 CTs não foram inventados. **85 vieram do OpenStreetMap**: arenas de areia no estado de São
Paulo, coletadas pela API Overpass, filtradas (um ginásio municipal com uma quadra de areia não é um
CT) e completadas com geocodificação reversa. Estão em 54 cidades, de Santos a São José do Rio
Preto.

Nada é inventado: campo que o OpenStreetMap não sabe fica vazio, porque são negócios reais e um
telefone errado é pior do que telefone nenhum.

```bash
npm run db:import-venues   # idempotente: reimportar atualiza, não duplica
```

Dados © colaboradores do OpenStreetMap, sob licença ODbL. O crédito aparece na tela de CTs, como a
licença exige.

---

## Estrutura

```
futcheck/
├── apps/
│   ├── api/                 Express + Prisma
│   │   ├── prisma/          schema, 6 migrations, seed, importador de CTs
│   │   └── src/
│   │       ├── lib/         venueAccess (autoridade por CT), imagens, storage, auditoria
│   │       ├── middlewares/ authenticate, requirePermission, rate limit, upload
│   │       └── modules/     auth · me · sessions · attendance · staff · venues · community · feed
│   └── web/                 Vue 3 + Vite
│       └── src/
│           ├── pages/app/   as 9 telas de quem joga
│           ├── pages/staff/ as 7 telas de quem trabalha
│           └── demo/        o servidor em memória do build de demonstração
├── packages/shared/         enums, permissões, schemas Zod, tipos, datas — a fonte da verdade
└── docs/                    decisões, permissões, regras de negócio, deploy
```

O pacote `shared` é o que impede os dois lados de divergirem: as mesmas regras de validação, os
mesmos enums e a mesma matriz de permissões são usados pela API para recusar e pelo app para
esconder.

---

## Comandos

| Comando                                        | O que faz                         |
| ---------------------------------------------- | --------------------------------- |
| `npm run dev`                                  | App e API juntos, com recarga     |
| `npm test`                                     | Todos os testes                   |
| `npm run lint` / `npm run typecheck`           | Qualidade e tipos                 |
| `npm run build`                                | Compila os três pacotes           |
| `npm run db:migrate` / `db:seed` / `db:studio` | Banco                             |
| `npm run db:import-venues`                     | Reimporta os CTs do OpenStreetMap |

---

## Deploy

Um **único serviço** serve tudo: a API em `/api/v1`, as imagens em `/static` e o app no resto.

Isso é proposital. O token de sessão vive num cookie `httpOnly`, e cookie só sobrevive se o app e a
API estiverem na **mesma origem**. Separados em dois domínios, ele viraria cookie de terceiro — que
o Safari bloqueia — e o login morreria em todo iPhone, justamente onde este app mais é usado.

O passo a passo com Neon (banco) e Render (aplicação), ambos gratuitos, está em
**[docs/deploy.md](docs/deploy.md)**. O [`render.yaml`](render.yaml) na raiz monta o serviço sozinho.

---

## O que ainda falta

Honestamente, para virar operação de verdade:

- **Fotos somem a cada deploy** no plano gratuito. O código prevê `STORAGE_DRIVER=s3`, mas esse
  driver ainda não foi escrito — só o de disco local existe.
- **O layout de desktop é o de celular esticado.** Funciona em 390px, 1366px e 1920px sem estouro
  horizontal, mas não aproveita a tela grande.
- **Sem tempo real.** As vagas só mudam ao recarregar; falta SSE ou WebSocket.
- **`listVenues` não pagina** e ordena em memória. Com 90 CTs passa; com o Brasil inteiro, não.
- **Sem mapa.** Os CTs aparecem em lista, ordenados por distância.

---

## Documentação

| Arquivo                                                | Conteúdo                                   |
| ------------------------------------------------------ | ------------------------------------------ |
| [docs/decisions.md](docs/decisions.md)                 | Registro de decisões de arquitetura (ADRs) |
| [docs/permissoes.md](docs/permissoes.md)               | A matriz de permissões explicada           |
| [docs/regras-de-negocio.md](docs/regras-de-negocio.md) | Prazos, capacidade, lista de espera        |
| [docs/deploy.md](docs/deploy.md)                       | Pôr no ar, e os limites do plano gratuito  |
