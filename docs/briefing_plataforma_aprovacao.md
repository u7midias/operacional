# Briefing: Plataforma de Aprovação de Posts — U7 Mídias

## Contexto

A U7 Mídias gerencia redes sociais de vários clientes usando Trello como
ferramenta interna de produção. Cada cliente tem um board próprio, organizado
nas listas:

`Informações → Criação de Legenda → Produção de Design/Vídeo → Revisão Geral → Aprovação → Agendar → Concluído`

**Fluxo atual (manual):** quando um post chega na lista "Aprovação", a equipe
monta um PDF manualmente (mockup do post + legenda, por formato), anexa
imagem/link de vídeo do Drive, e envia tudo por WhatsApp. O cliente aprova ou
pede ajuste respondendo no próprio WhatsApp — sem registro estruturado.

**Objetivo:** construir uma plataforma nos moldes da mLabs, onde:
1. O cliente acessa um **link único e fixo**, sem login/senha.
2. Ele vê um **painel/calendário do mês inteiro**, com todos os posts em
   qualquer etapa do pipeline, com status simplificado.
3. Ele consegue **aprovar ou pedir alteração** (com comentário livre)
   diretamente pelo post, sem PDF, sem WhatsApp.
4. Essa ação reflete **automaticamente de volta no Trello** (move o card e
   comenta), mantendo o Trello como ferramenta de produção interna.

---

## Decisões já fechadas

| Decisão | Escolha |
|---|---|
| O que substitui o quê | Trello continua sendo usado internamente para produção; a nova plataforma **integra via API**, não substitui o Trello |
| Como o cliente pede ajuste | **Comentário livre em texto**, sem lista de motivos fixos |
| Autenticação do cliente | **Link único e fixo por cliente**, sem senha (nunca expira, sempre mostra o mês vigente) |
| Sync de aprovação → Trello | **Automático**: mover o card de lista + comentar no card |
| Escopo do painel do cliente | Mostra **todo o pipeline**, do início ao fim, com status traduzido/simplificado (não expõe o nome das listas internas) |
| Banco de dados / backend | **Supabase** (Postgres + Auth + Edge Functions + Realtime) |

---

## Convenções de dados no Trello (já existentes, sem precisar mudar nada lá)

| Campo do post | De onde vem no Trello |
|---|---|
| Formato (feed / story / reels) | Label colorido do card (`FEED`, `REELS`, `story`) |
| Legenda | Descrição do card |
| Imagem | Anexo do card |
| Vídeo | Link do Google Drive dentro da descrição do card |
| Data agendada | Data de vencimento (due date) do card |
| Etapa/status | Lista em que o card está |

---

## Mapeamento de status (Trello → visão do cliente)

| Listas internas do Trello | Status mostrado ao cliente |
|---|---|
| Informações, Criação de Legenda, Produção de Design/Vídeo, Revisão Geral | **Em produção** |
| Aprovação | **Aguardando sua aprovação** ← cliente age aqui |
| Agendar | **Aprovado, aguardando publicação** |
| Concluído | **Publicado** |

---

## Fluxo de sincronização (os dois sentidos)

**1. Trello → Plataforma (leitura)**
Card entra na lista "Aprovação" (ou muda de lista em geral) → webhook do
Trello dispara → Edge Function `sync-trello` lê label, descrição, anexo/link,
due date → cria/atualiza o registro em `posts` com o status traduzido.

**2. Cliente age na Plataforma**
Cliente abre o link fixo (`/aprovar/{token}`) → vê o calendário do mês →
clica num post "aguardando aprovação" → vê a mídia + legenda → escolhe:
- **Aprovar**, ou
- **Pedir alteração** (com comentário livre)

**3. Plataforma → Trello (escrita, automática)**
- **Aprovou** → Edge Function `approve-post` grava em `approvals`, atualiza
  `posts.status`, e via API do Trello: move o card para **"Agendar"** +
  comenta `"✅ Aprovado pelo cliente em {data/hora}"`.
- **Pediu alteração** → grava o comentário em `approvals`, move o card de
  volta para **"Revisão Geral"** + comenta no card
  `"🔁 Cliente solicitou alteração: {comentário}"`.

---

## Nota de segurança

O cliente não faz login — o acesso é só pelo token na URL. Por isso, **não**
expor as tabelas via chave `anon` do Supabase com RLS aberta. O ideal:
- RLS habilitado em todas as tabelas, **sem nenhuma policy** (bloqueia tudo
  por padrão para a chave anon).
- Toda leitura/escrita do portal do cliente passa por **Edge Functions**
  usando a **service role key**, que valida o token contra a tabela
  `clients` antes de buscar/gravar qualquer dado.

---

## Schema SQL (Supabase / Postgres)

```sql
-- ============================================================
-- Schema: Plataforma de Aprovação de Posts (U7 Mídias)
-- Integração: Trello (produção interna) <-> Supabase (portal do cliente)
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. CLIENTS
-- ============================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trello_board_id text not null unique,
  access_token text not null unique
    default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_clients_access_token on clients (access_token);

-- ============================================================
-- 2. POSTS
-- ============================================================
create type post_status as enum (
  'em_producao',
  'aguardando_aprovacao',
  'aprovado',
  'publicado'
);

create type post_format as enum ('feed', 'story', 'reels');
create type media_type as enum ('imagem', 'video');

create table posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,

  trello_card_id text not null unique,
  trello_list_id text not null,
  trello_list_name text,

  format post_format,
  caption text,
  media_type media_type,
  media_url text,

  scheduled_date date,
  status post_status not null default 'em_producao',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_posts_client_id on posts (client_id);
create index idx_posts_scheduled_date on posts (scheduled_date);
create index idx_posts_status on posts (status);

-- ============================================================
-- 3. APPROVALS
-- ============================================================
create type approval_action as enum ('aprovado', 'alteracao_solicitada');

create table approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  action approval_action not null,
  comment text,
  created_at timestamptz not null default now()
);

create index idx_approvals_post_id on approvals (post_id);

-- ============================================================
-- 4. SYNC LOG (debug do webhook)
-- ============================================================
create table trello_sync_log (
  id uuid primary key default gen_random_uuid(),
  trello_card_id text,
  event_type text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table clients enable row level security;
alter table posts enable row level security;
alter table approvals enable row level security;
alter table trello_sync_log enable row level security;
-- Nenhuma policy criada de propósito: anon key não lê/escreve nada.
-- Edge Functions usam a service_role key, que ignora RLS.

-- ============================================================
-- 6. TRIGGER: updated_at automático em posts
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_posts_updated_at
before update on posts
for each row execute function set_updated_at();
```

---

## O que construir (para o Claude Code)

1. **Migrations do Supabase** com o schema acima.
2. **Edge Function `sync-trello`**: recebe webhook do Trello, faz o parsing
   de label/descrição/anexo/due date, faz upsert em `posts`, grava em
   `trello_sync_log`.
3. **Edge Function `approve-post`**: recebe `{ token, post_id, action, comment }`,
   valida o token contra `clients`, grava em `approvals`, atualiza
   `posts.status`, chama a API do Trello para mover o card e comentar.
4. **Frontend do portal do cliente** (rota `/aprovar/[token]`):
   - Calendário/lista do mês com todos os posts e status simplificado.
   - Tela de detalhe do post (mídia + legenda) com botões "Aprovar" /
     "Pedir alteração" quando status = `aguardando_aprovacao`.

## O que fica de fora do escopo do Code (requer você)

- Criar o projeto no Supabase e pegar URL + chaves (anon e service role).
- Gerar API key + token do Trello (trello.com/app-key) e configurar o
  webhook apontando para a Edge Function `sync-trello`.
- Colar essas credenciais nas variáveis de ambiente do projeto.
- Autorizar o deploy final (Vercel/Netlify/Supabase Hosting).
