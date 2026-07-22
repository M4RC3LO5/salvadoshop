-- ============================================================
-- SalvadoShop — Campos de comprador/rastreio em pedidos + RLS para Auxiliar
-- Migração: 008_admin_pedidos_campos_e_rls.sql
-- Criado em: 2026-07-13
-- Contexto: Bloco 7 — campos de comprador e rastreio em pedidos + RLS
-- granular para Auxiliar
-- ============================================================

-- ============================================================
-- COLUNAS: pedidos — comprador (dados de execução de contrato, LGPD,
-- retenção documentada no CLAUDE.md) e rastreio (preenchidos no envio)
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprador_nome     TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprador_email    TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprador_telefone TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS codigo_rastreio    TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS transportadora     TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS url_rastreamento   TEXT;

-- ============================================================
-- RLS: helper para o papel Auxiliar (mesmo padrão de is_master(),
-- só trocando o valor do enum role_admin verificado)
-- ============================================================

CREATE OR REPLACE FUNCTION is_auxiliar()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_usuarios
    WHERE user_id = auth.uid() AND role = 'auxiliar' AND ativo = TRUE
  );
$$;

-- ---- pedidos ----
CREATE POLICY "Auxiliar vê todos os pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (is_auxiliar());

-- Auxiliar opera pedidos (status operacional, rastreio), mas cancelamento
-- e reembolso ficam exclusivos do Master: USING bloqueia tocar em pedidos já
-- cancelados/reembolsados, WITH CHECK bloqueia levar um pedido a esses estados.
CREATE POLICY "Auxiliar atualiza pedidos operacionais"
  ON pedidos FOR UPDATE
  TO authenticated
  USING (is_auxiliar() AND status NOT IN ('cancelado', 'reembolsado'))
  WITH CHECK (is_auxiliar() AND status NOT IN ('cancelado', 'reembolsado'));

-- ---- pedido_itens ----
CREATE POLICY "Auxiliar vê todos os itens"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (is_auxiliar());

-- Nenhuma policy de INSERT ou DELETE para Auxiliar: ele não cria nem remove
-- pedidos/itens, apenas visualiza e atualiza o status operacional.

-- ============================================================
-- TRIGGER: validação de transição de status em pedidos. RLS não consegue
-- comparar OLD.status com NEW.status, então a regra de "quem pode levar o
-- pedido de qual estado para qual estado" vive aqui.
-- ============================================================

CREATE OR REPLACE FUNCTION validar_transicao_status_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualização sem mudança de status (ex.: corrigir código de rastreio):
  -- sempre permitida, quem chega aqui já passou pela RLS.
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Contexto de sistema (service role): auth.uid() é NULL. Cobre o webhook
  -- do Stripe (aguardando_pagamento -> pago) e a RPC estornar_pedido_estoque
  -- (aguardando_pagamento -> cancelado). SEM ESTE GUARD O CHECKOUT QUEBRA.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Master: qualquer transição, inclusive cancelar e reembolsar.
  IF is_master() THEN
    RETURN NEW;
  END IF;

  -- Auxiliar: apenas o fluxo operacional, sempre para frente.
  IF is_auxiliar() THEN
    IF (OLD.status = 'pago'         AND NEW.status = 'em_separacao')
    OR (OLD.status = 'em_separacao' AND NEW.status = 'enviado')
    OR (OLD.status = 'enviado'      AND NEW.status = 'entregue') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'TRANSICAO_NAO_PERMITIDA: % -> %', OLD.status, NEW.status
    USING ERRCODE = '28000';
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_transicao_status ON pedidos;
CREATE TRIGGER trg_validar_transicao_status
  BEFORE UPDATE OF status ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION validar_transicao_status_pedido();

-- ============================================================
-- LIMITAÇÃO CONHECIDA: RLS restringe linhas e o estado resultante da
-- transição de status, não colunas individuais. Impedir o Auxiliar de
-- alterar campos que não deveria (ex.: `total`) depende da API route
-- escrever apenas as colunas permitidas para esse papel — o banco, por si
-- só, não impõe esse recorte por coluna.
-- ============================================================
