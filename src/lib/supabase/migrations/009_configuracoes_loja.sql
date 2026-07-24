-- ============================================================
-- SalvadoShop — Tabela de configurações da loja
-- Migração: 009_configuracoes_loja.sql
-- Criado em: 2026-07-23
-- Contexto: Bloco 8 — tabela de configurações da loja para os emails
-- transacionais
-- ============================================================

-- ============================================================
-- TABELA: configuracoes_loja
-- ============================================================

-- Por ora existe UMA loja só (a linha é criada via seed abaixo), mas a
-- tabela já nasce com id próprio para não travar uma evolução futura para
-- múltiplas lojas (ver CLAUDE.md, seção 16.3).
--
-- email_contato: endereço público exibido ao cliente (ex: rodapé, emails
-- transacionais enviados a ele).
-- email_notificacoes: endereço interno que recebe aviso de pedido novo.
CREATE TABLE IF NOT EXISTS configuracoes_loja (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja           TEXT        NOT NULL,
  email_contato       TEXT        NOT NULL,
  email_notificacoes  TEXT        NOT NULL,
  telefone            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente (reutiliza a função
-- genérica set_updated_at() criada na 001_schema_inicial.sql)
-- ============================================================

CREATE TRIGGER trg_configuracoes_loja_updated_at
  BEFORE UPDATE ON configuracoes_loja
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE configuracoes_loja ENABLE ROW LEVEL SECURITY;

-- Sem policy de INSERT/DELETE: a linha é criada via seed, não pela UI.

CREATE POLICY "Admins leem as configurações da loja"
  ON configuracoes_loja FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Somente Master atualiza as configurações da loja"
  ON configuracoes_loja FOR UPDATE
  TO authenticated
  USING (is_master());

-- ============================================================
-- SEED: linha inicial (idempotente — não duplica se rodar duas vezes)
-- ============================================================

-- Valores placeholder — ajustar quando o domínio real (salvadoshop.com.br)
-- existir.
INSERT INTO configuracoes_loja (nome_loja, email_contato, email_notificacoes, telefone)
SELECT 'SalvadoShop', 'contato@salvadoshop.com.br', 'contato@salvadoshop.com.br', NULL
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_loja);
