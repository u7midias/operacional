# Plataforma de Aprovação de Posts — U7 Mídias

Portal onde o cliente acessa um link único e fixo (sem login), vê o
calendário do mês com todos os posts em produção e aprova ou pede alteração
diretamente — sem PDF, sem WhatsApp. A ação reflete automaticamente no
Trello (move o card + comenta), que continua sendo a ferramenta interna de
produção.

Ver `docs/briefing_plataforma_aprovacao.md` para o contexto completo do
produto e as decisões de arquitetura.

## Estrutura

```
app/aprovar/              Portal do cliente (Next.js, App Router)
app/admin/                Painel interno pra cadastrar clientes (protegido por senha)
components/               MonthCalendar, PostModal, StatusBadge
lib/                      Tipos e client de API (chama as Edge Functions)
supabase/migrations/      Schema do Postgres (clients, posts, approvals, ...)
supabase/functions/
  sync-trello/            Recebe webhook do Trello -> upsert em `posts`
  approve-post/            Grava a decisão do cliente -> move card + comenta no Trello
  get-posts/               Única leitura pública (valida token) para o portal do cliente
  admin-clients/           Lista/cadastra clientes e cria o webhook do Trello sozinho
```

Segurança: RLS habilitado em todas as tabelas **sem nenhuma policy** — a
chave `anon` não lê nem escreve nada. Todo acesso do portal do cliente passa
pelas Edge Functions acima, que usam a `service_role` key e validam o token
do cliente manualmente antes de qualquer leitura/escrita.

## Setup

### 1. Supabase

1. Crie um projeto em https://supabase.com e pegue a **Project URL**, a
   **anon key** e a **service_role key**.
2. Rode a migration em `supabase/migrations/0001_init.sql` (SQL Editor do
   dashboard, ou `supabase db push` via CLI).
3. Configure os secrets das Edge Functions (dashboard: Edge Functions >
   Secrets, ou `supabase secrets set`) — `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente, só falta:
   - `TRELLO_API_KEY`
   - `TRELLO_API_TOKEN`
   - `ADMIN_SECRET` — uma senha à sua escolha, usada só pelo painel `/admin`.
4. Deploy das funções: `supabase functions deploy sync-trello approve-post get-posts admin-clients`.

### 2. Trello

1. Gere uma API key + token em https://trello.com/power-ups/admin (crie um
   "aplicativo" qualquer, a chave e o token ficam disponíveis nas
   configurações dele).
2. Cadastre cada cliente pelo painel `/admin` do site (não precisa de SQL
   nem de criar o webhook manualmente — veja "Cadastrando um cliente novo"
   abaixo).

### 3. Frontend

1. Copie `.env.example` para `.env.local` e preencha
   `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` (`https://<project>.supabase.co/functions/v1`).
2. `npm install && npm run dev`.

#### Deploy no Vercel

1. Suba o código para o repositório no GitHub.
2. Em https://vercel.com, entre com sua conta do GitHub, clique em
   **Add New... > Project** e selecione o repositório `operacional`.
3. Em "Environment Variables", adicione
   `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` com a URL das Edge Functions
   (`https://<project>.supabase.co/functions/v1`).
4. Clique em **Deploy**. O Vercel builda e publica automaticamente — a cada
   novo push no repositório, ele atualiza o site sozinho.
5. O link a enviar para cada cliente fica
   `https://<projeto>.vercel.app/aprovar/?token={access_token}`.

### Cadastrando um cliente novo

Depois do setup inicial, cadastrar cada cliente novo é só isso — sem SQL,
sem chamar API do Trello na mão:

1. Acesse `/admin` no site (ex: `https://<projeto>.vercel.app/admin`).
2. Digite a senha (o valor que você colocou em `ADMIN_SECRET`).
3. Preencha o nome do cliente e o código do board do Trello (o de 8
   caracteres que aparece na URL do board: `trello.com/b/AbCd1234/...`).
4. Clique em **Cadastrar**. O sistema cria o cliente, registra o webhook no
   Trello automaticamente e mostra o link pronto pra copiar e enviar.

## Observações

- As listas internas do Trello (`Informações`, `Criação de Legenda`,
  `Produção de Design/Vídeo`, `Revisão Geral`, `Aprovação`, `Agendar`,
  `Concluído`) precisam existir com esses nomes exatos em cada board — é
  como `sync-trello` e `approve-post` mapeiam lista ↔ status e resolvem o
  `idList` de destino ao mover um card.
- `sync-trello` resincroniza o card inteiro a cada evento do webhook (não
  tenta interpretar o payload incremental), então cobre qualquer mudança
  (lista, legenda, anexo, due date) com uma única lógica.
- Não há verificação de assinatura do webhook do Trello (`X-Trello-Webhook`)
  nesta primeira versão — o endpoint aceita qualquer POST bem formado. Para
  produção, considere validar o HMAC contra o Client Secret do Trello.
