-- 032_listas_venda.sql
-- Lista de Venda: documento derivado da triagem, editado no sistema.
-- Migration aditiva (só cria tabelas novas): segura antes do deploy do código (18.9).
-- Dados internos da triagem (custo, origem, fornecedor, estado, observações,
-- lote, ean) NÃO têm coluna aqui, de propósito.

CREATE TABLE public.listas_venda (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triagem_lista_id  uuid REFERENCES public.triagem_listas(id) ON DELETE SET NULL,
  titulo            text NOT NULL,
  rodape            text NOT NULL DEFAULT 'Preços válidos para lote fechado, pagamento à vista e retirada no local por conta do comprador.',
  criado_por        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.listas_venda_itens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_venda_id   uuid NOT NULL REFERENCES public.listas_venda(id) ON DELETE CASCADE,
  estoque_item_id  uuid REFERENCES public.estoque_itens(id) ON DELETE SET NULL, -- só rastreio
  ordem            integer NOT NULL,
  descricao        text NOT NULL,
  fabricante       text,
  referencia       text,
  vencimento       text,                      -- formato livre, ex.: '04/2028'
  qtd_caixas       integer NOT NULL CHECK (qtd_caixas >= 0),
  unid_por_caixa   integer NOT NULL CHECK (unid_por_caixa >= 1),
  preco_unitario   numeric(12,2) CHECK (preco_unitario >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Sem coluna de total: R$ Cx = preco_unitario * unid_por_caixa e
-- R$ Total = R$ Cx * qtd_caixas são calculados na tela/exportação.

CREATE INDEX idx_listas_venda_itens_lista_ordem
  ON public.listas_venda_itens (lista_venda_id, ordem);
CREATE INDEX idx_listas_venda_created_at
  ON public.listas_venda (created_at DESC);   -- listagem "mais recente primeiro"

CREATE TRIGGER trg_listas_venda_updated_at
  BEFORE UPDATE ON public.listas_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_listas_venda_itens_updated_at
  BEFORE UPDATE ON public.listas_venda_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.listas_venda       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_venda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem listas de venda" ON public.listas_venda
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins inserem listas de venda" ON public.listas_venda
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins atualizam listas de venda" ON public.listas_venda
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins excluem listas de venda" ON public.listas_venda
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins veem itens de listas de venda" ON public.listas_venda_itens
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins inserem itens de listas de venda" ON public.listas_venda_itens
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins atualizam itens de listas de venda" ON public.listas_venda_itens
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins excluem itens de listas de venda" ON public.listas_venda_itens
  FOR DELETE TO authenticated USING (public.is_admin());

-- GRANTs explícitos (item 30). anon não precisa de nada aqui.
REVOKE ALL ON public.listas_venda, public.listas_venda_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listas_venda, public.listas_venda_itens TO authenticated;
