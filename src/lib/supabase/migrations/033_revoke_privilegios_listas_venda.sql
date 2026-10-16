-- 033_revoke_privilegios_listas_venda.sql
-- A 032 concedeu SELECT/INSERT/UPDATE/DELETE a authenticated, mas o Supabase
-- também concede por padrão TRUNCATE, REFERENCES e TRIGGER. TRUNCATE ignora a
-- RLS, então qualquer sessão authenticated (inclusive anônima) poderia, em
-- tese, esvaziar as tabelas. Nenhum código usa esses privilégios.

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.listas_venda, public.listas_venda_itens
  FROM authenticated;
