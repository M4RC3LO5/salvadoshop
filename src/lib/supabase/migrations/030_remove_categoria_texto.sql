-- ============================================================
-- SalvadoShop — remove a coluna de texto produtos.categoria
-- Migração: 030_remove_categoria_texto.sql
-- Item 21 do BACKLOG.md.
--
-- Contexto: desde o PR #40 (produção em 76e5c6c), vitrine, página de produto
-- e página de lote leem a categoria por join com a tabela categorias, via
-- produtos.categoria_id. A triagem e todos os caminhos de escrita (POST/PUT
-- de produto, duplicar, aprovações) já gravam categoria_id. A coluna de
-- texto produtos.categoria não tem mais nenhuma leitura de estado atual —
-- a única leitura restante era a tela de edição do admin, migrada para o
-- join na mesma tarefa desta migração. categoria_id passa a ser a única
-- fonte da categoria de um produto.
--
-- Auditoria de constraints (lição 18.10, direto do banco de produção):
-- nenhuma CHECK, FK, PK ou UNIQUE constraint de produtos referencia
-- categoria (texto) — só a coluna categoria_id tem FK própria
-- (produtos_categoria_id_fkey). O único objeto dependente é o índice
-- idx_produtos_categoria, removido explicitamente abaixo (e que seria
-- removido de qualquer forma junto com a coluna).
--
-- Este DROP é destrutivo (lição 18.9): só é aplicado quando o deploy do
-- código que já parou de ler/escrever a coluna estiver no ar. Nesta tarefa
-- a migração é testada apenas em branch de desenvolvimento — a aplicação em
-- produção acontece junto do merge do PR correspondente.
--
-- Migrations anteriores (001, 002, 023) que criam, semeiam ou fazem backfill
-- da coluna continuam intactas — rodam antes desta na sequência e continuam
-- válidas como documentação histórica do schema.
-- ============================================================

DROP INDEX IF EXISTS idx_produtos_categoria;

ALTER TABLE produtos DROP COLUMN categoria;
