-- ============================================================
-- SalvadoShop — categorias: leitura pública
-- Migração: 029_categorias_leitura_publica.sql
-- Contexto: a vitrine passou a ler o nome da categoria via join com a
-- tabela categorias (em vez da coluna de texto produtos.categoria) para
-- montar as abas de filtro. A única policy de SELECT em categorias exigia
-- is_admin() — visitante não autenticado (a vitrine é pública) não conseguia
-- ler a tabela, e o join sempre voltava null, mesmo com categoria_id
-- preenchido. Descoberto testando em branch de desenvolvimento antes do
-- merge, não em produção.
--
-- O nome/slug de categoria nunca foi dado sensível — já era 100% público
-- via a coluna de texto produtos.categoria, sem nenhuma RLS. Esta policy só
-- formaliza para a tabela normalizada o mesmo nível de exposição que a
-- coluna de texto sempre teve.
-- ============================================================

CREATE POLICY "Categorias são visíveis para todos"
  ON categorias FOR SELECT
  USING (true);
