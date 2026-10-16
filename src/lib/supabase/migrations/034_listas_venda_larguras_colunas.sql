-- 034_listas_venda_larguras_colunas.sql
-- Largura das colunas da Lista de Venda, ajustável na tela de impressão e
-- salva por lista. Guarda a PORCENTAGEM de cada coluna:
--   {"descricao":28,"fabr":15,"ref":8.5,"vencto":9,"qtd":8.5,"und":8.5,"cx":10,"total":12.5}
-- NULL = layout padrão (definido no código). Migration aditiva: coluna
-- nullable, o código em produção não a conhece e continua funcionando (18.9).

ALTER TABLE public.listas_venda
  ADD COLUMN larguras_colunas jsonb;

-- Garantia mínima no banco: se preenchida, tem de ser um objeto JSON.
-- As chaves, os limites por coluna e a soma ≈ 100 são validados com Zod na API.
ALTER TABLE public.listas_venda
  ADD CONSTRAINT chk_listas_venda_larguras_objeto
  CHECK (larguras_colunas IS NULL OR jsonb_typeof(larguras_colunas) = 'object');
