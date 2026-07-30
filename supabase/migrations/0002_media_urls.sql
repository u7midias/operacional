-- ============================================================
-- Suporte a posts com múltiplas imagens (carrossel)
-- ============================================================

alter table posts add column media_urls text[] not null default '{}';

update posts set media_urls = array[media_url] where media_url is not null;

alter table posts drop column media_url;
