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
app/aprovar/[token]/   Portal do cliente (Next.js, App Router)
components/            MonthCalendar, PostModal, StatusBadge
lib/                   Tipos e client de API (chama as Edge Functions)
supabase/migrations/   Schema do Postgres (clients, posts, approvals, ...)
supabase/functions/
  sync-trello/         Recebe webhook do Trello -> upsert em `posts`
  approve-post/         Grava a decisão do cliente -> move card + comenta no Trello
  get-posts/            Única leitura pública (valida token) para o portal
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
   Secrets, ou `supabase secrets set`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TRELLO_API_KEY`
   - `TRELLO_API_TOKEN`
4. Deploy das funções: `supabase functions deploy sync-trello approve-post get-posts`.

### 2. Trello

1. Gere uma API key + token em https://trello.com/app-key.
2. Para cada board de cliente, crie um registro em `clients`:
   ```sql
   insert into clients (name, trello_board_id)
   values ('Nome do Cliente', '<id do board no Trello>');
   -- access_token é gerado automaticamente; é esse valor que compõe o link
   -- /aprovar/{access_token} enviado ao cliente.
   ```
3. Cadastre um webhook do Trello por board, apontando para a Edge Function
   `sync-trello`:
   ```
   POST https://api.trello.com/1/webhooks?key={key}&token={token}
   idModel={board_id}&callbackURL={SUPABASE_URL}/functions/v1/sync-trello
   ```

### 3. Frontend

1. Copie `.env.example` para `.env.local` e preencha
   `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` (`https://<project>.supabase.co/functions/v1`).
2. `npm install && npm run dev`.
3. Deploy (Vercel/Netlify) com a mesma env var configurada no projeto.

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
