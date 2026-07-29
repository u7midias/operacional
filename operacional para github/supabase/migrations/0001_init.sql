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

create index idx_trello_sync_log_card_id on trello_sync_log (trello_card_id);

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
