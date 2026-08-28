-- 015_triagem_foto_url_opcional.sql
-- A foto da triagem passa a ser descartada apos a extracao dos dados pela IA.
-- Ela e apenas insumo de captura, nao imagem de catalogo, entao o caminho
-- deixa de ser obrigatorio.

alter table public.estoque_itens
  alter column foto_url drop not null;
