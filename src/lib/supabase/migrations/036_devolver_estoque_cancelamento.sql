-- ============================================================
-- SalvadoShop — devolve o estoque ao cancelar ou reembolsar pedido
-- Migração: 036_devolver_estoque_cancelamento.sql
--
-- Contexto: criar_pedido_com_estoque debita o estoque ao criar o pedido.
-- Cancelar pelo admin (PATCH /api/admin/pedidos/[id]) só muda o status, então
-- o estoque debitado nunca voltava. A RPC estornar_pedido_estoque devolvia
-- estoque, mas nenhum código a chama hoje.
--
-- Regra: um trigger em pedidos é a fonte única da devolução. Quando o status
-- passa para 'cancelado' ou 'reembolsado' a partir de um status anterior ao
-- envio, cada item volta para produtos.estoque.
--
-- Motivo: no banco, a regra vale para qualquer caminho (admin, RPC, job
-- futuro) sem depender de a aplicação lembrar de chamar algo.
-- ============================================================

CREATE OR REPLACE FUNCTION devolver_estoque_pedido_cancelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só devolve se o pedido ainda não saiu da loja. 'enviado' e 'entregue' NÃO
  -- devolvem: o produto já foi embora; quando voltar, o ajuste é manual.
  -- cancelado -> reembolsado também não devolve de novo, porque
  -- OLD.status = 'cancelado' não está na lista abaixo.
  IF NEW.status IN ('cancelado', 'reembolsado')
     AND OLD.status IN ('aguardando_cotacao_frete', 'aguardando_pagamento', 'pago', 'em_separacao')
  THEN
    UPDATE produtos
    SET estoque = estoque + pi.quantidade
    FROM pedido_itens pi
    WHERE pi.pedido_id = NEW.id
      AND produtos.id = pi.produto_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_devolver_estoque_cancelamento
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION devolver_estoque_pedido_cancelado();

-- Função de trigger: ninguém a chama diretamente.
REVOKE EXECUTE ON FUNCTION public.devolver_estoque_pedido_cancelado()
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- estornar_pedido_estoque: remove o loop que devolvia estoque. O trigger acima
-- já devolve ao mudar o status para 'cancelado'; manter o loop causaria
-- estoque em dobro. Sobra só o UPDATE condicional do status.
-- CREATE OR REPLACE preserva os privilégios (migration 031: só service_role),
-- por isso nenhum GRANT/REVOKE é reaplicado aqui.
-- ============================================================

CREATE OR REPLACE FUNCTION estornar_pedido_estoque(
  p_pedido_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pedidos
  SET status = 'cancelado'
  WHERE id = p_pedido_id AND status IN ('aguardando_cotacao_frete', 'aguardando_pagamento');
END;
$$;
