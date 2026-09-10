-- ============================================================
-- SalvadoShop — status 'rascunho' e coluna url_ml
-- Migração: 026_add_rascunho_status_and_url_ml.sql
--
-- DOCUMENTAÇÃO RETROATIVA — NÃO APLICAR.
-- Esta migration já está em produção. Foi aplicada em 2026-06-26
-- (registrada no histórico do Supabase como
-- "add_rascunho_status_and_url_ml", versão 20260626121336), mas o
-- arquivo correspondente nunca foi criado no repositório — achado
-- durante a investigação do item 20 do BACKLOG.md (histórico de
-- migrations fora de sincronia). O conteúdo abaixo é o SQL exato
-- recuperado de supabase_migrations.schema_migrations.statements,
-- não uma reconstrução por inferência.
-- ============================================================

-- Adiciona status 'rascunho' ao enum (precisa ser antes dos outros para manter ordem)
ALTER TYPE status_produto ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'pendente';

-- Adiciona coluna url_ml à tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS url_ml text;
