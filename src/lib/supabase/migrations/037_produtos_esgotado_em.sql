-- ============================================================
-- SalvadoShop — marca quando um produto esgotou (produtos.esgotado_em)
-- Migração: 037_produtos_esgotado_em.sql
--
-- Contexto: produto tipo_a com estoque 0 aparecia normal na vitrine, com
-- "Comprar" ativo; o cliente só descobria no fim do checkout.
--
-- Regra: a vitrine mostra o produto esgotado em preto e branco, sem botão de
-- compra, no fim da lista, e o esconde 30 dias depois de esgotar. Para saber
-- "há quanto tempo está esgotado", guardamos o momento em esgotado_em.
-- Um trigger BEFORE mantém a coluna: estoque > 0 limpa (volta ao normal);
-- estoque <= 0 grava now() só na primeira vez (não renova a cada update).
--
-- Motivo: no banco, vale para qualquer caminho que mude o estoque (checkout,
-- cancelamento da 036, edição no admin) sem depender do código da aplicação.
--
-- Migration aditiva e retrocompatível (18.9): coluna nullable; o código em
-- produção não a conhece e continua funcionando. Aplicar antes do deploy.
-- ============================================================

ALTER TABLE produtos ADD COLUMN esgotado_em timestamptz;

CREATE OR REPLACE FUNCTION marcar_esgotado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estoque > 0 THEN
    NEW.esgotado_em := NULL;
  ELSIF NEW.esgotado_em IS NULL THEN
    NEW.esgotado_em := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marcar_esgotado_em
  BEFORE INSERT OR UPDATE OF estoque ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION marcar_esgotado_em();

-- Função de trigger: ninguém a chama diretamente.
REVOKE EXECUTE ON FUNCTION public.marcar_esgotado_em()
  FROM PUBLIC, anon, authenticated;

-- Backfill: quem já está sem estoque passa a contar os 30 dias a partir de agora.
UPDATE produtos
SET esgotado_em = now()
WHERE estoque <= 0 AND esgotado_em IS NULL;
