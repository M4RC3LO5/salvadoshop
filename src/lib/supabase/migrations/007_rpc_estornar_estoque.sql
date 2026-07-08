-- ============================================================
-- SalvadoShop — RPC de estorno de estoque
-- Migração: 007_rpc_estornar_estoque.sql
-- Criado em: 2026-07-03
-- Contexto: Bloco 6 — RPC de estorno de estoque para pedidos com Checkout
-- Session expirada / não paga.
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
  -- Transição idempotente e livre de corrida: só cancela se o pedido ainda
  -- estiver aguardando pagamento. Se já foi pago, cancelado, ou não existe,
  -- nenhuma linha é afetada e a função encerra sem devolver estoque — evita
  -- estorno duplicado (reentrega do evento) e estorno de pedido pago
  -- (evento expired chegando após um pagamento tardio).
  UPDATE pedidos
  SET status = 'cancelado'
  WHERE id = p_pedido_id AND status = 'aguardando_pagamento';

  GET DIAGNOSTICS v_linhas_afetadas = ROW_COUNT;

  IF v_linhas_afetadas = 0 THEN
    RETURN;
  END IF;

  -- Devolve ao estoque a quantidade de cada item do pedido cancelado.
  FOR v_item IN
    SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = p_pedido_id
  LOOP
    UPDATE produtos
    SET estoque = estoque + v_item.quantidade
    WHERE id = v_item.produto_id;
  END LOOP;
END;
$$;

-- Sem GRANT EXECUTE proposital: esta função será chamada exclusivamente pelo
-- webhook usando a service role, que bypassa GRANTs. Mantê-la sem GRANT
-- garante que clientes autenticados não possam invocá-la diretamente.
