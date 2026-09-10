-- Bloqueio de preço invertido em produto tipo_a não exclusivo.
-- Regra de negócio confirmada por Marcelo: o Mercado Livre é sempre mais
-- caro que o site, porque cobra taxas que a venda direta não tem —
-- preco_site >= preco_ml é sempre erro de digitação, nunca cenário real.
-- Hoje isso só gera um aviso no admin (não bloqueia); já produziu um
-- produto publicado com o preço invertido em produção (corrigido
-- manualmente antes desta migration — auditoria confirmou zero produtos
-- tipo_a não exclusivos com preco_site >= preco_ml).
--
-- Constraints CHECK de produtos hoje (mapeadas direto do banco, lição
-- 18.10, antes de escrever esta migration):
--   chk_exclusividade_canal_publicado — exige preco_site not null e
--     url_ml preenchida quando não exclusivo, para tipo_a publicado.
--   chk_tipo_b_sem_preco — exige preco_ml null para todo tipo_b.
-- Nenhuma das duas trata a relação entre preco_ml e preco_site.

ALTER TABLE produtos
  ADD CONSTRAINT chk_preco_ml_maior_que_site
  CHECK (
    NOT (
      tipo = 'tipo_a'
      AND status = 'publicado'
      AND exclusivo_site = false
      AND preco_site >= preco_ml
    )
  );
