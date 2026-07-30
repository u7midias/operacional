-- ============================================================
-- Status do post agora espelha as listas reais do Trello (com uma lista
-- própria para "Alteração", separada de "Revisão Geral"). Trocamos o enum
-- fixo por text + check constraint porque esse conjunto de status já
-- mudou uma vez e é provável que mude de novo.
-- ============================================================

alter table posts alter column status drop default;
alter table posts alter column status type text using status::text;

update posts set status = case status
  when 'em_producao' then 'em_producao'
  when 'aguardando_aprovacao' then 'em_aprovacao'
  when 'aprovado' then 'em_agendamento'
  when 'publicado' then 'publicado'
  else 'em_producao'
end;

alter table posts add constraint posts_status_check check (
  status in (
    'criacao_legenda',
    'em_producao',
    'em_revisao',
    'em_aprovacao',
    'em_alteracao',
    'em_agendamento',
    'publicado'
  )
);

alter table posts alter column status set default 'em_producao';
alter table posts alter column status set not null;

drop type post_status;
