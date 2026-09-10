-- ============================================================
-- SalvadoShop — novo status de pedido: aguardando cotação de frete
-- Migração: 028_status_aguardando_cotacao_frete.sql
--
-- DOCUMENTAÇÃO RETROATIVA — NÃO APLICAR.
-- Esta migration já está em produção. Foi aplicada em 2026-08-28
-- (registrada no histórico do Supabase como
-- "status_aguardando_cotacao_frete", versão 20260828171005), mas o
-- arquivo correspondente nunca foi criado no repositório — o próprio
-- comentário original abaixo já a identificava como
-- "018_status_aguardando_cotacao_frete.sql", confirmando que era para
-- ter sido o arquivo 018 e ele nunca chegou a ser commitado. Achado
-- durante a investigação do item 20 do BACKLOG.md (histórico de
-- migrations fora de sincronia). O conteúdo abaixo é o SQL exato
-- recuperado de supabase_migrations.schema_migrations.statements,
-- não uma reconstrução por inferência.
-- ============================================================

-- ============================================================
-- SalvadoShop — novo status de pedido: aguardando cotação de frete
-- Migração: 018_status_aguardando_cotacao_frete.sql
-- Contexto: o pedido passa a nascer ANTES do frete ser conhecido — o Master
-- cota manualmente depois (ver migration 019). Precisa ser sua própria
-- migração porque um valor de enum recém-criado não pode ser usado
-- (DEFAULT, INSERT, comparação) na mesma transação em que foi adicionado.
-- ============================================================

ALTER TYPE status_pedido ADD VALUE 'aguardando_cotacao_frete' BEFORE 'aguardando_pagamento';
