-- ============================================================
-- SalvadoShop — CPF do comprador no pedido (pedidos.comprador_cpf)
-- Migração: 038_pedidos_comprador_cpf.sql
--
-- Contexto: o checkout coletava o CPF só visualmente; ele não era enviado
-- para a API e não existia coluna em pedidos.
--
-- Regra: o CPF é obrigatório (nota fiscal e declaração de conteúdo; base
-- legal LGPD: obrigação legal, seção 6.1 do CLAUDE.md). Guarda só os 11
-- dígitos, sem máscara; a validação dos dígitos verificadores é feita na tela
-- e na API, e o CHECK abaixo garante apenas o formato.
--
-- Nullable de propósito: pedidos antigos não têm CPF.
--
-- Migration aditiva e retrocompatível (18.9): coluna nullable; o código em
-- produção não a conhece e continua funcionando. Aplicar antes do deploy.
-- ============================================================

ALTER TABLE pedidos ADD COLUMN comprador_cpf text;

ALTER TABLE pedidos ADD CONSTRAINT chk_pedidos_comprador_cpf_formato
  CHECK (comprador_cpf IS NULL OR comprador_cpf ~ '^[0-9]{11}$');
