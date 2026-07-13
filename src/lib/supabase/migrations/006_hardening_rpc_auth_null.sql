-- ============================================================
-- SalvadoShop — Hardening da checagem de autorização na RPC de pedido
-- Migração: 006_hardening_rpc_auth_null.sql
-- Criado em: 2026-07-03
-- Contexto: Bloco 6 — hardening da checagem de autorização para tratar
-- auth.uid() NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION criar_pedido_com_estoque(
  p_pedido_id        UUID,
  p_cliente_id       UUID,
  p_forma_pagamento  forma_pagamento,
  p_endereco_entrega JSONB,
  p_itens            JSONB  -- [{ "produto_id": uuid, "quantidade": int }]
)
RETURNS TABLE (pedido_id UUID, total NUMERIC)
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
  -- Falha de autorização corrigida: SECURITY DEFINER bypassa a RLS de
  -- INSERT em `pedidos`, então o cliente_id precisa ser validado aqui.
  -- Barra também chamadas sem sessão (auth.uid() IS NULL), já que
  -- `p_cliente_id <> NULL` avaliaria como NULL e não dispararia o IF.
  IF auth.uid() IS NULL OR p_cliente_id <> auth.uid() THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '28000';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'CARRINHO_VAZIO' USING ERRCODE = 'P0001';
  END IF;

  -- Cria o pedido com total provisório 0 — atualizado ao final do loop
  INSERT INTO pedidos (id, cliente_id, status, total, forma_pagamento, endereco_entrega)
  VALUES (p_pedido_id, p_cliente_id, 'aguardando_pagamento', 0, p_forma_pagamento, p_endereco_entrega);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id := (v_item->>'produto_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INTEGER;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'QUANTIDADE_INVALIDA: %', v_produto_id USING ERRCODE = 'P0001';
    END IF;

    -- Decremento atômico e condicional: só afeta a linha se houver estoque
    -- suficiente, evitando estoque negativo em compras concorrentes. O preço
    -- é lido aqui (nunca recebido do cliente) para impedir manipulação.
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

  UPDATE pedidos SET total = v_total WHERE id = p_pedido_id;

  RETURN QUERY SELECT p_pedido_id, v_total;
END;
$$;

-- Chamada pelo cliente autenticado (inclusive sessão anônima) a partir da
-- rota POST /api/checkout/stripe, antes de criar a Checkout Session
GRANT EXECUTE ON FUNCTION criar_pedido_com_estoque(UUID, UUID, forma_pagamento, JSONB, JSONB) TO authenticated;
