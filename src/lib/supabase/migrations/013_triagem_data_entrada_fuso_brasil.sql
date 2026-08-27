-- 013_triagem_data_entrada_fuso_brasil.sql
-- current_date no Postgres usa UTC. Apos as 21h no Brasil a data gravada
-- adiantava um dia. Passa a usar o fuso America/Sao_Paulo.

alter table public.estoque_itens
  alter column data_entrada
  set default (now() at time zone 'America/Sao_Paulo')::date;
