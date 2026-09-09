-- ============================================================
-- SalvadoShop — Invariante de exclusividade de canal para publicado
-- Migração: 022_invariante_exclusividade_publicado.sql
-- Criado em: 2026-09-09
-- Contexto: a regra de exclusividade de canal (item 13) só existia no
-- schema Zod de api/admin/produtos. Qualquer caminho de código que
-- grave em `produtos` sem passar por esse Zod — hoje, notadamente
-- api/triagem/publicar/route.ts — pode publicar um produto tipo_a em
-- um dos dois estados inválidos:
--   1. exclusivo_site = false com url_ml nula/vazia (não exclusivo,
--      mas sem anúncio no ML pra onde apontar)
--   2. exclusivo_site = true com preco_venda nulo (exclusivo, mas sem
--      preço definido)
-- A restrição vale só para status = 'publicado' — rascunho incompleto
-- continua permitido (fluxo de cadastro e clonagem, que nasce em
-- rascunho, dependem disso) e produto tipo_b não é afetado.
-- ============================================================

ALTER TABLE produtos
  ADD CONSTRAINT chk_exclusividade_canal_publicado
  CHECK (
    NOT (
      tipo = 'tipo_a' AND status = 'publicado' AND (
        (exclusivo_site = false AND (url_ml IS NULL OR url_ml = ''))
        OR
        (exclusivo_site = true AND preco_venda IS NULL)
      )
    )
  );
