-- ============================================================
-- SalvadoShop — frete cotado manualmente + dados legais da loja
-- Migração: 019_pedidos_frete_e_dados_loja.sql
-- Contexto: o checkout deixa de fechar o pedido com o total final na hora.
-- Ele nasce em 'aguardando_cotacao_frete' (migration 018) só com o subtotal
-- dos itens; o Master cota o frete manualmente pelo painel admin, e só então
-- o pedido vira 'aguardando_pagamento' com o total definitivo — que passa a
-- ser SEMPRE subtotal + frete, nunca mais um valor solto que pode divergir.
-- Também grava os dados legais da loja (razão social, CNPJ, endereço),
-- exigidos no rodapé/página Sobre pelo CDC (CLAUDE.md 6.3) — sem UI nova
-- nesta migração, só o dado disponível para uma tarefa futura.
-- ============================================================

-- ============================================================
-- configuracoes_loja: dados legais + endereço + link do Mercado Livre
-- ============================================================

ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS razao_social      TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS cnpj              TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS logradouro        TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS numero            TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS complemento       TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS bairro            TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS cidade            TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS uf                TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS cep               TEXT;
ALTER TABLE configuracoes_loja ADD COLUMN IF NOT EXISTS mercado_livre_url TEXT;

UPDATE configuracoes_loja SET
  razao_social      = 'Comercial Dantas de Salvados e Sinistros Ltda',
  cnpj              = '07128451000158',
  logradouro        = 'R. Fernandes da Silva Bueno',
  numero            = '176',
  bairro            = 'Jardim Ponte Rasa',
  cidade            = 'São Paulo',
  uf                = 'SP',
  cep               = '03882000',
  mercado_livre_url = 'https://lista.mercadolivre.com.br/_CustId_477940563',
  pix_chave         = 'ceciliarodrigues.rc@gmail.com',
  pix_tipo_chave    = 'email',
  pix_beneficiario  = 'COMERCIALDANTAS SALVADOS',
  pix_cidade        = 'SAO PAULO';

-- ============================================================
-- pedidos: subtotal + frete separados, total passa a ser calculado
-- ============================================================

-- 1) subtotal — o que antes era `total` (frete nunca existiu até agora, então
--    o valor atual é sempre o subtotal correto para backfill).
ALTER TABLE pedidos ADD COLUMN subtotal NUMERIC(10, 2);
UPDATE pedidos SET subtotal = total;
ALTER TABLE pedidos ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_subtotal_check CHECK (subtotal >= 0);

-- 2) frete — 0 até a cotação do Master; modalidade só é preenchida junto.
ALTER TABLE pedidos ADD COLUMN frete_valor NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_frete_valor_check CHECK (frete_valor >= 0);
ALTER TABLE pedidos ADD COLUMN frete_modalidade TEXT;

-- 3) total — deixa de ser um valor gravado manualmente (a causa do bug de
--    arredondamento visto no teste: um total podia divergir da soma real) e
--    passa a ser sempre subtotal + frete_valor, calculado pelo Postgres.
ALTER TABLE pedidos DROP COLUMN total;
ALTER TABLE pedidos ADD COLUMN total NUMERIC(10, 2) GENERATED ALWAYS AS (subtotal + frete_valor) STORED;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_total_check CHECK (total >= 0);

-- 4) o pedido agora nasce aguardando cotação de frete, não aguardando
--    pagamento — só sabemos o total (e liberamos Pix/cartão) depois da cotação.
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'aguardando_cotacao_frete';

-- 5) stripe_payment_id não é mais usado — não sobrou Stripe no sistema.
ALTER TABLE pedidos DROP COLUMN stripe_payment_id;

-- ============================================================
-- RPC criar_pedido_com_estoque: grava subtotal (não mais total, que agora é
-- gerado) e o pedido nasce em 'aguardando_cotacao_frete'. Mantém intactos os
-- guards de autorização das migrations 005/006 (auth.uid() = p_cliente_id,
-- barra sessão nula) e a baixa atômica e condicional de estoque da 004.
-- ============================================================

-- O tipo de retorno muda (coluna `total` -> `subtotal`), o que o Postgres não
-- permite via CREATE OR REPLACE — precisa dropar antes de recriar.
DROP FUNCTION IF EXISTS criar_pedido_com_estoque(UUID, UUID, forma_pagamento, JSONB, JSONB);

CREATE FUNCTION criar_pedido_com_estoque(
  p_pedido_id        UUID,
  p_cliente_id       UUID,
  p_forma_pagamento  forma_pagamento,
  p_endereco_entrega JSONB,
  p_itens            JSONB  -- [{ "produto_id": uuid, "quantidade": int }]
)
RETURNS TABLE (pedido_id UUID, subtotal NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item            JSONB;
  v_produto_id      UUID;
  v_quantidade      INTEGER;
  v_preco_unitario  NUMERIC;
  v_total           NUMERIC := 0;
  v_linhas_afetadas INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_cliente_id <> auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'CARRINHO_VAZIO' USING ERRCODE = 'P0001';
  END IF;

  -- Cria o pedido com subtotal provisório 0 — atualizado ao final do loop.
  -- `total` não entra aqui: é coluna gerada (subtotal + frete_valor).
  INSERT INTO pedidos (id, cliente_id, status, subtotal, forma_pagamento, endereco_entrega)
  VALUES (p_pedido_id, p_cliente_id, 'aguardando_cotacao_frete', 0, p_forma_pagamento, p_endereco_entrega);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item->>'produto_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'QUANTIDADE_INVALIDA: %', v_produto_id USING ERRCODE = 'P0001';
    END IF;

    UPDATE produtos
    SET estoque = estoque - v_quantidade
    WHERE id = v_produto_id AND status = 'publicado' AND estoque >= v_quantidade
    RETURNING preco_site INTO v_preco_unitario;

    GET DIAGNOSTICS v_linhas_afetadas = ROW_COUNT;

    IF v_linhas_afetadas = 0 OR v_preco_unitario IS NULL THEN
      RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE: %', v_produto_id USING ERRCODE = 'P0001';
    END IF;

    v_total := v_total + (v_preco_unitario * v_quantidade);

    INSERT INTO pedido_itens (pedido_id, produto_id, preco_unitario, quantidade)
    VALUES (p_pedido_id, v_produto_id, v_preco_unitario, v_quantidade);
  END LOOP;

  UPDATE pedidos SET subtotal = v_total WHERE id = p_pedido_id;

  RETURN QUERY SELECT p_pedido_id, v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION criar_pedido_com_estoque(UUID, UUID, forma_pagamento, JSONB, JSONB) TO authenticated;

-- ============================================================
-- RPC estornar_pedido_estoque: agora também cancela pedidos ainda esperando
-- cotação de frete (antes só cobria aguardando_pagamento). Não é chamada por
-- nenhum código hoje — o webhook do Stripe que a acionava foi removido —,
-- mas fica correta para quando um job de expiração automática existir.
-- ============================================================

CREATE OR REPLACE FUNCTION estornar_pedido_estoque(
  p_pedido_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linhas_afetadas INTEGER;
  v_item            RECORD;
BEGIN
  UPDATE pedidos
  SET status = 'cancelado'
  WHERE id = p_pedido_id AND status IN ('aguardando_cotacao_frete', 'aguardando_pagamento');

  GET DIAGNOSTICS v_linhas_afetadas = ROW_COUNT;

  IF v_linhas_afetadas = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = p_pedido_id
  LOOP
    UPDATE produtos
    SET estoque = estoque + v_item.quantidade
    WHERE id = v_item.produto_id;
  END LOOP;
END;
$$;
