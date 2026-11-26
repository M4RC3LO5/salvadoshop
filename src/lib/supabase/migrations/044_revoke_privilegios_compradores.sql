-- 044: mesmo cuidado da 033 para as tabelas da 043.
-- TRUNCATE ignora a RLS; anon nunca usa estas tabelas.
REVOKE ALL
  ON public.segmentos, public.compradores, public.compradores_segmentos, public.google_buscas
  FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.segmentos, public.compradores, public.compradores_segmentos, public.google_buscas
  FROM authenticated;
