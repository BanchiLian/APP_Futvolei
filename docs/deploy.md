# Colocar o FutCheck no ar

Este guia leva o app de "só roda na minha máquina" a um endereço público que
funciona no celular. São dois cadastros gratuitos e cerca de quinze minutos.

## Como está montado, e por quê

Um **único serviço** serve tudo:

| Caminho   | O que responde      |
| --------- | ------------------- |
| `/api/v1` | a API               |
| `/static` | as imagens enviadas |
| o resto   | o app Vue           |

Isso é proposital. O token de sessão vive num cookie `httpOnly`, e cookie só
sobrevive se app e API estiverem na **mesma origem**. Se o app ficasse no
GitHub Pages e a API em outro domínio, o cookie viraria "de terceiro": o Safari
bloqueia esses por padrão, e o login morreria em todo iPhone — justamente onde
este app mais vai ser usado.

O banco fica fora, num PostgreSQL gerenciado.

## 1. Banco de dados (Neon)

1. Crie uma conta em <https://neon.com> e um projeto, região mais perto do
   Brasil (`aws-us-east-1`).
2. Copie a **connection string**. Ela se parece com:
   `postgresql://usuario:senha@ep-algo.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Guarde: é o `DATABASE_URL` do próximo passo.

## 2. Aplicação (Render)

1. Crie uma conta em <https://render.com> e conecte sua conta do GitHub.
2. **New → Blueprint**, escolha o repositório `APP_Futvolei`. O Render lê o
   `render.yaml` da raiz e monta o serviço sozinho.
3. Ele vai pedir os valores marcados como `sync: false`. Preencha:

   | Variável               | O que pôr                                                 |
   | ---------------------- | --------------------------------------------------------- |
   | `DATABASE_URL`         | a string do Neon, do passo 1                              |
   | `SUPER_ADMIN_NAME`     | seu nome                                                  |
   | `SUPER_ADMIN_EMAIL`    | seu e-mail                                                |
   | `SUPER_ADMIN_USERNAME` | o apelido para entrar, ex. `elian`                        |
   | `SUPER_ADMIN_PASSWORD` | **12+ caracteres.** `admin` e senhas óbvias são recusadas |

   Os dois segredos de JWT o Render gera sozinho.

4. **Create**. O primeiro deploy demora alguns minutos.

A cada boot o serviço executa, nesta ordem e sem duplicar nada:

```
migrations  →  garante o super admin  →  dados de demonstração (se pedidos)  →  sobe
```

## 3. Dados iniciais

Um banco novo sobe **vazio**: sem CT, sem grade de aulas, sem nada para
confirmar presença. E hoje não existe tela para cadastrar um CT ou uma grade —
esses dados só vêm do seed.

Então, para a primeira subida, adicione no Render a variável:

```
SEED_DEMO_DATA=sim-quero-dados-de-demonstracao
```

Isso carrega 5 CTs, a grade semanal, as sessões das próximas semanas, 15
pessoas fictícias e 6 fotos no feed. **Apague a variável** quando a arena tiver
dados de verdade — enquanto ela estiver lá, o deploy reinsere o que faltar.

Sem essa variável o deploy avisa que não carregou nada e sobe normalmente.

## 4. Conferir

- `https://seu-servico.onrender.com/health` responde `{"status":"ok"}`.
- Abra o endereço no celular, entre com seu usuário e senha, e instale pela
  opção "Adicionar à tela de início".

## Limites do plano gratuito

| Limite                                   | Consequência                                       | Como resolver                           |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| O serviço hiberna após 15 min sem acesso | a primeira visita depois disso demora ~50s         | plano pago do Render (a partir de US$7) |
| O disco é apagado a cada deploy          | **as fotos enviadas somem**; o resto fica no banco | ver abaixo                              |
| Sem acesso a terminal                    | tudo tem de acontecer no start, como está montado  | plano pago                              |

### As fotos

Fotos de perfil e do feed são gravadas em disco, e o disco do plano gratuito é
descartado a cada deploy. O código já prevê a saída: `STORAGE_DRIVER` aceita
`s3`, mas **esse driver ainda não foi escrito** — só o de disco local existe
(`apps/api/src/lib/storage.ts`). Implementá-lo apontando para o Cloudflare R2
(10 GB gratuitos) resolve de vez, e é uma tarefa fechada: o banco já guarda uma
_chave_, nunca uma URL, então muda esse arquivo e mais nada.

## O que falta para ser operação real

1. **Telas de administração** para cadastrar CT, grade de aulas e dayuse. Sem
   isso o sistema depende do seed e não serve a uma arena de verdade.
2. **Armazenamento de fotos** que sobreviva ao deploy (acima).
3. **Domínio próprio**, ex. `app.suaarena.com.br`, no lugar do endereço do
   Render.
