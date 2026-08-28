-- ============================================================
-- SalvadoShop — identificação de pedido pelo extrato (centavos) via trigger
-- Migração: 020_trigger_ajustar_centavos_identificacao.sql
-- Contexto: o ajuste de centavos rodava só dentro da ação "Cotar frete" (API
-- admin), então pedidos de retirada — que não passam por cotação de frete —
-- saíam de aguardando_cotacao_frete sem identificação nenhuma. Movido para
-- trigger BEFORE UPDATE pelo mesmo motivo de `total` ser GENERATED: não pode
-- existir caminho de escrita (rota, RPC, admin futuro) que escape da regra.
-- ============================================================

CREATE OR REPLACE FUNCTION ajustar_centavos_identificacao_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_centavos_alvo     INTEGER;
  v_total_antes_cent  INTEGER;
  v_reais_base        INTEGER;
  v_centavos_atuais   INTEGER;
  v_reais_ajustados   INTEGER;
  v_total_depois_cent INTEGER;
  v_delta_cent        INTEGER;
BEGIN
  -- Alvo: os dois últimos dígitos do número sequencial do pedido.
  v_centavos_alvo := NEW.numero_pedido % 100;

  v_total_antes_cent := ROUND((NEW.subtotal + NEW.frete_valor) * 100)::INTEGER;
  v_reais_base := v_total_antes_cent / 100;  -- divisão inteira = floor (valores sempre >= 0)
  v_centavos_atuais := v_total_antes_cent - v_reais_base * 100;

  -- SEMPRE para cima: se os centavos-alvo forem menores ou iguais aos atuais,
  -- soma 1 real antes de aplicá-los — nunca reduz o que o cliente paga.
  IF v_centavos_alvo <= v_centavos_atuais THEN
    v_reais_ajustados := v_reais_base + 1;
  ELSE
    v_reais_ajustados := v_reais_base;
  END IF;

  v_total_depois_cent := v_reais_ajustados * 100 + v_centavos_alvo;
  v_delta_cent := v_total_depois_cent - v_total_antes_cent;

  -- Frete cotado (> 0): a diferença é embutida no frete. Retirada (frete = 0):
  -- não há frete para absorver a diferença, então vai no subtotal. Nunca
  -- toca pedido_itens.preco_unitario — o preço de cada item fica intacto.
  IF NEW.frete_valor > 0 THEN
    NEW.frete_valor := NEW.frete_valor + (v_delta_cent / 100.0);
  ELSE
    NEW.subtotal := NEW.subtotal + (v_delta_cent / 100.0);
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE UPDATE OF status: só considera a atualização quando `status` é
-- explicitamente escrito no UPDATE (mesmo padrão de trg_validar_transicao_status).
-- O WHEN garante que só dispara na ENTRADA em aguardando_pagamento vindo de
-- outro status — reentrar já estando em aguardando_pagamento não aciona o
-- ajuste de novo (critério de aceite 3).
DROP TRIGGER IF EXISTS trg_ajustar_centavos_pedido ON pedidos;
CREATE TRIGGER trg_ajustar_centavos_pedido
  BEFORE UPDATE OF status ON pedidos
  FOR EACH ROW
  WHEN (NEW.status = 'aguardando_pagamento' AND OLD.status <> 'aguardando_pagamento')
  EXECUTE FUNCTION ajustar_centavos_identificacao_pedido();
