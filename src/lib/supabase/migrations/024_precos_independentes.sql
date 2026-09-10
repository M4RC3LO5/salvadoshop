-- Inversão da modelagem de preço de produtos tipo_a.
-- Antes: preco_site era coluna GENERATED, coalesce(preco_venda,
-- round(preco_ml * 0.82, 2)) — a regra dos 18% estava invertida (o certo
-- seria dividir por 1.18, não multiplicar por 0.82) e o percentual era
-- premissa fixa embutida na fórmula.
-- Agora: o admin digita os dois preços reais (site e Mercado Livre) e o
-- percentual de diferença é sempre calculado a partir deles na exibição —
-- nunca gravado, nunca premissa.

-- preco_site deixa de ser GENERATED e vira coluna comum, preenchida
-- diretamente pelo admin. DROP EXPRESSION preserva os valores já
-- materializados na coluna — nenhuma conversão de fórmula é aplicada,
-- os preços atuais dos produtos existentes não mudam nesta migration.
ALTER TABLE produtos ALTER COLUMN preco_site DROP EXPRESSION;

-- preco_venda deixa de existir como conceito separado. Auditoria em
-- produção (6 produtos tipo_a, todos não-exclusivos): preco_venda é NULL
-- em 100% dos casos — a remoção não perde nenhum dado. preco_site passa a
-- ser a única fonte de preço do site, tanto para produto exclusivo quanto
-- não-exclusivo.
ALTER TABLE produtos DROP COLUMN preco_venda;

-- chk_tipo_a_preco (da migration 001, anterior à exclusividade de canal)
-- exigia preco_ml NOT NULL para todo produto tipo_a, sem exceção — nunca foi
-- ajustada quando o item 13 introduziu produto exclusivo do site. Produto
-- exclusivo não tem preço de ML (o campo nem aparece no formulário), então
-- essa constraint quebraria a publicação de qualquer exclusivo. Removida —
-- a obrigatoriedade de preco_ml para não-exclusivo já é garantida pelo Zod
-- na API e não tem uma expressão condicional simples equivalente em CHECK
-- (dependeria de exclusivo_site, como chk_exclusividade_canal_publicado).
ALTER TABLE produtos DROP CONSTRAINT chk_tipo_a_preco;

-- Constraint antiga assumia preco_venda como o preço do produto exclusivo.
-- Nova regra: produto tipo_a publicado sempre precisa de preco_site
-- preenchido; url_ml continua obrigatória apenas quando não exclusivo.
ALTER TABLE produtos DROP CONSTRAINT chk_exclusividade_canal_publicado;

ALTER TABLE produtos
  ADD CONSTRAINT chk_exclusividade_canal_publicado
  CHECK (
    NOT (
      tipo = 'tipo_a' AND status = 'publicado' AND (
        preco_site IS NULL
        OR (exclusivo_site = false AND (url_ml IS NULL OR url_ml = ''))
      )
    )
  );
