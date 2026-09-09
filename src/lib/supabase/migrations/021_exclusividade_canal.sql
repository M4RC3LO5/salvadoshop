-- ============================================================
-- SalvadoShop — Exclusividade de canal (BACKLOG item 13)
-- Migração: 021_exclusividade_canal.sql
-- Criado em: 2026-09-09
-- Contexto: produto Tipo A passa a poder ser marcado como exclusivo
-- do site (sem anúncio no Mercado Livre). Nesse caso o preço vem de
-- `preco_venda`, definido manualmente pelo admin, em vez do desconto
-- automático de 18% sobre `preco_ml`. O desconto de 18% continua
-- travado para produto anunciado no ML — `preco_venda` não é uma
-- permissão para sobrescrever esse preço, existe só para produto
-- exclusivo (decisão registrada em CLAUDE.md).
-- ============================================================

-- Novas colunas
ALTER TABLE produtos
  ADD COLUMN exclusivo_site BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN preco_venda    NUMERIC(10, 2);

-- Backfill a partir do estado atual de url_ml
UPDATE produtos
SET exclusivo_site = (url_ml IS NULL OR url_ml = '');

-- Recria preco_site: agora usa preco_venda quando presente, senão cai no
-- cálculo automático de 18% sobre preco_ml. Coluna gerada não pode ter a
-- expressão alterada in-place — precisa ser removida e recriada.
ALTER TABLE produtos DROP COLUMN preco_site;

ALTER TABLE produtos
  ADD COLUMN preco_site NUMERIC(10, 2)
    GENERATED ALWAYS AS (COALESCE(preco_venda, ROUND(preco_ml * 0.82, 2))) STORED;
