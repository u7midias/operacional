-- Consultas de apoio pro SQL Editor do Supabase.
--
-- Contexto: o portal mostrava posts sem card correspondente no Trello. A
-- causa era que nada nunca apagava um post — card excluído ou arquivado
-- continuava no banco pra sempre. Isso foi corrigido em `sync-trello`
-- (apaga quando o card some) e no botão "Sincronizar" do painel (relê o
-- board inteiro e limpa o que sobrou).
--
-- O SQL abaixo é só pra CONFERIR o que está gravado. Ele não tem como saber
-- sozinho o que existe no Trello — quem faz essa comparação é o botão
-- "Sincronizar", porque só ele consegue perguntar pra API do Trello.

-- 1) Quantos posts cada cliente tem hoje.
select c.name as cliente,
       count(*) filter (where p.scheduled_date is not null) as com_data,
       count(*) filter (where p.scheduled_date is null)     as sem_data,
       count(*)                                             as total
from clients c
left join posts p on p.client_id = c.id
group by c.name
order by c.name;

-- 2) Posts de um cliente, com link pro card no Trello.
--    Se o link abrir "card não encontrado" ou o card aparecer arquivado, é
--    um dos fantasmas. Troque o nome do cliente abaixo.
select p.scheduled_date as data,
       p.status,
       p.format,
       p.trello_list_name as lista_no_trello,
       'https://trello.com/c/' || p.trello_card_id as card,
       p.id as post_id
from posts p
join clients c on c.id = p.client_id
where c.name ilike '%seu chico%'
  and p.scheduled_date is not null
order by p.scheduled_date;

-- 3) Limpeza pontual do SEU CHICO SNOOKER (board 5ldXyeyp).
--    São os 12 cards que estavam arquivados no Trello em 01/08/2026 e que
--    tinham virado post no banco. Os 4 primeiros são os que apareciam no
--    calendário do cliente (1, 3, 3 e 5 de agosto); o resto não tinha data,
--    então não aparecia, mas também não deveria estar gravado.
--
--    Isso é só o remendo do que já está no banco. O que impede de acontecer
--    de novo são as funções sync-trello e admin-clients atualizadas.
delete from posts
where trello_card_id in (
  '6a6a28ac0afa2e912cce29a1', -- Story 01/08 - Show do Dia
  '6a6a284d2c5a843b4c9ecf47', -- Story 03/08 - Horário de Funcionamento
  '6a6a284f74dd8cf63739c8d6', -- Story 03/08 - Agenda da Semana
  '6a6a2874ff192f36d649a824', -- Story 05/08 - Agenda
  '6a31ca29da872b6001622a2d', -- ACESSOS
  '6a56486645dab9c2bea01fc7', -- c5
  '6a5e89169cdd005d6ebe43b6', -- SHOWS DA SEMANA
  '6a551a62ee08bdf3cb8a16c6', -- SHOW QUINTA FEIRA HOJE
  '6a42e59d4bcdf71b981ffeb0', -- NOVIDADE NO SEU CHICO SHOW DE QUINTA
  '6a4c1ca5e01dfea3d6291ca8', -- FLYER QUINTA
  '6a42e4dbb69c2408759753c5', -- SINUCA
  '6a3406d025804344b78f13a1'  -- SHOW DE SÁBADO
);
