-- ============================================================
-- SalvadoShop — Schema inicial
-- Migração: 001_schema_inicial.sql
-- Criado em: 2026-06-25
-- ============================================================
-- Habilita a extensão necessária para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE tipo_produto AS ENUM ('tipo_a', 'tipo_b');

CREATE TYPE status_produto AS ENUM ('pendente', 'publicado', 'rejeitado', 'arquivado');

CREATE TYPE role_admin AS ENUM ('master', 'auxiliar');

CREATE TYPE status_aprovacao AS ENUM ('pendente', 'aprovado', 'rejeitado');

CREATE TYPE tipo_alteracao AS ENUM ('criacao', 'edicao', 'exclusao', 'status');

CREATE TYPE status_pedido AS ENUM (
  'aguardando_pagamento',
  'pago',
  'em_separacao',
  'enviado',
  'entregue',
  'cancelado',
  'reembolsado'
);

CREATE TYPE forma_pagamento AS ENUM ('pix', 'cartao_credito', 'cartao_debito');

-- ============================================================
-- TABELA: produtos
-- ============================================================

CREATE TABLE produtos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT        NOT NULL,
  slug             TEXT        NOT NULL UNIQUE,
  descricao        TEXT,
  specs_tecnicas   JSONB,
  tipo             tipo_produto NOT NULL,

  -- Tipo A: preços (Tipo B fica NULL)
  preco_ml         NUMERIC(10, 2),
  preco_site       NUMERIC(10, 2)
    GENERATED ALWAYS AS (ROUND(preco_ml * 0.82, 2)) STORED,

  status           status_produto NOT NULL DEFAULT 'pendente',
  categoria        TEXT,
  sinistro         TEXT,                        -- origem do produto (ex: "leilão Receita Federal")
  estoque          INTEGER       NOT NULL DEFAULT 0,

  -- Tipo B: quantidade fixa do lote (Tipo A fica NULL)
  quantidade_lote  INTEGER,

  criado_por       UUID        NOT NULL,        -- FK → admin_usuarios.id
  aprovado_por     UUID,                        -- FK → admin_usuarios.id (NULL até aprovação)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validações de negócio
  CONSTRAINT chk_tipo_a_preco
    CHECK (tipo <> 'tipo_a' OR preco_ml IS NOT NULL),
  CONSTRAINT chk_tipo_b_sem_preco
    CHECK (tipo <> 'tipo_b' OR preco_ml IS NULL)
);

CREATE INDEX idx_produtos_slug     ON produtos (slug);
CREATE INDEX idx_produtos_status   ON produtos (status);
CREATE INDEX idx_produtos_tipo     ON produtos (tipo);
CREATE INDEX idx_produtos_categoria ON produtos (categoria);

-- ============================================================
-- TABELA: produto_imagens
-- ============================================================

CREATE TABLE produto_imagens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id      UUID        NOT NULL REFERENCES produtos (id) ON DELETE CASCADE,
  url_cloudinary  TEXT        NOT NULL,
  public_id       TEXT        NOT NULL UNIQUE,  -- public_id do Cloudinary (necessário para exclusão)
  ordem           SMALLINT    NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_produto_imagens_produto ON produto_imagens (produto_id, ordem);

-- ============================================================
-- TABELA: admin_usuarios
-- ============================================================

CREATE TABLE admin_usuarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE,       -- FK → auth.users.id (Supabase Auth)
  role       role_admin  NOT NULL,
  nome       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  ativo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_usuarios_user_id ON admin_usuarios (user_id);
CREATE INDEX idx_admin_usuarios_role    ON admin_usuarios (role);

-- Adiciona FKs de produtos → admin_usuarios após a criação da tabela
ALTER TABLE produtos
  ADD CONSTRAINT fk_produtos_criado_por
    FOREIGN KEY (criado_por) REFERENCES admin_usuarios (id),
  ADD CONSTRAINT fk_produtos_aprovado_por
    FOREIGN KEY (aprovado_por) REFERENCES admin_usuarios (id);

-- ============================================================
-- TABELA: aprovacoes
-- ============================================================

CREATE TABLE aprovacoes (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id       UUID             NOT NULL REFERENCES produtos (id) ON DELETE CASCADE,
  admin_id         UUID             NOT NULL REFERENCES admin_usuarios (id),
  tipo_alteracao   tipo_alteracao   NOT NULL,
  dados_anteriores JSONB,                       -- snapshot do produto antes da alteração
  dados_novos      JSONB            NOT NULL,   -- snapshot dos dados submetidos
  status           status_aprovacao NOT NULL DEFAULT 'pendente',
  motivo_rejeicao  TEXT,                        -- obrigatório quando status = 'rejeitado'
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,

  CONSTRAINT chk_motivo_rejeicao
    CHECK (status <> 'rejeitado' OR motivo_rejeicao IS NOT NULL)
);

CREATE INDEX idx_aprovacoes_produto ON aprovacoes (produto_id);
CREATE INDEX idx_aprovacoes_admin   ON aprovacoes (admin_id);
CREATE INDEX idx_aprovacoes_status  ON aprovacoes (status);

-- ============================================================
-- TABELA: pedidos
-- ============================================================

CREATE TABLE pedidos (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id         UUID           NOT NULL,   -- FK → auth.users.id (Supabase Auth)
  status             status_pedido  NOT NULL DEFAULT 'aguardando_pagamento',
  total              NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  forma_pagamento    forma_pagamento NOT NULL,
  stripe_payment_id  TEXT,                      -- NULL para pagamentos Pix
  mercadopago_id     TEXT,                      -- NULL para pagamentos Stripe
  endereco_entrega   JSONB          NOT NULL,   -- snapshot do endereço no momento do pedido
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_cliente    ON pedidos (cliente_id);
CREATE INDEX idx_pedidos_status     ON pedidos (status);
CREATE INDEX idx_pedidos_created_at ON pedidos (created_at DESC);

-- ============================================================
-- TABELA: pedido_itens
-- ============================================================

CREATE TABLE pedido_itens (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID           NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  produto_id      UUID           NOT NULL REFERENCES produtos (id),
  preco_unitario  NUMERIC(10, 2) NOT NULL CHECK (preco_unitario >= 0),  -- snapshot do preço na compra
  quantidade      INTEGER        NOT NULL DEFAULT 1 CHECK (quantidade > 0)
);

CREATE INDEX idx_pedido_itens_pedido  ON pedido_itens (pedido_id);
CREATE INDEX idx_pedido_itens_produto ON pedido_itens (produto_id);

-- ============================================================
-- TABELA: access_logs  (Marco Civil — mínimo 6 meses de retenção)
-- ============================================================

CREATE TABLE access_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,                              -- NULL para usuários não autenticados
  ip         INET        NOT NULL,
  rota       TEXT        NOT NULL,
  metodo     TEXT        NOT NULL CHECK (metodo IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_logs_user_id    ON access_logs (user_id);
CREATE INDEX idx_access_logs_ip         ON access_logs (ip);
CREATE INDEX idx_access_logs_created_at ON access_logs (created_at DESC);

-- ============================================================
-- TABELA: consentimentos  (LGPD — Art. 7º)
-- ============================================================

CREATE TABLE consentimentos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,                              -- NULL para consentimento pré-login
  tipo       TEXT        NOT NULL,              -- ex: 'cookies', 'marketing', 'analytics'
  aceito     BOOLEAN     NOT NULL,
  ip         INET        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consentimentos_user_id ON consentimentos (user_id);
CREATE INDEX idx_consentimentos_tipo    ON consentimentos (tipo);

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE produtos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_imagens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprovacoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos    ENABLE ROW LEVEL SECURITY;

-- Helper: retorna o role do usuário autenticado
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS role_admin LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM admin_usuarios WHERE user_id = auth.uid() AND ativo = TRUE LIMIT 1;
$$;

-- Helper: verifica se o usuário é Master
CREATE OR REPLACE FUNCTION is_master()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_usuarios
    WHERE user_id = auth.uid() AND role = 'master' AND ativo = TRUE
  );
$$;

-- Helper: verifica se o usuário é admin (Master ou Auxiliar)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_usuarios
    WHERE user_id = auth.uid() AND ativo = TRUE
  );
$$;

-- ---- produtos ----
CREATE POLICY "Produtos publicados são visíveis para todos"
  ON produtos FOR SELECT
  USING (status = 'publicado');

CREATE POLICY "Admins veem todos os produtos"
  ON produtos FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins podem inserir produtos"
  ON produtos FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins podem atualizar produtos"
  ON produtos FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Somente Master pode excluir produtos"
  ON produtos FOR DELETE
  TO authenticated
  USING (is_master());

-- ---- produto_imagens ----
CREATE POLICY "Imagens de produtos publicados são visíveis para todos"
  ON produto_imagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM produtos p
      WHERE p.id = produto_imagens.produto_id AND p.status = 'publicado'
    )
  );

CREATE POLICY "Admins veem todas as imagens"
  ON produto_imagens FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins podem gerenciar imagens"
  ON produto_imagens FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- admin_usuarios ----
CREATE POLICY "Master vê todos os admins"
  ON admin_usuarios FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "Auxiliar vê apenas seu próprio registro"
  ON admin_usuarios FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Somente Master gerencia admins"
  ON admin_usuarios FOR ALL
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- ---- aprovacoes ----
CREATE POLICY "Master vê todas as aprovações"
  ON aprovacoes FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "Auxiliar vê suas próprias aprovações"
  ON aprovacoes FOR SELECT
  TO authenticated
  USING (
    admin_id = (
      SELECT id FROM admin_usuarios WHERE user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Admins podem criar aprovações"
  ON aprovacoes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Somente Master pode atualizar aprovações"
  ON aprovacoes FOR UPDATE
  TO authenticated
  USING (is_master());

-- ---- pedidos ----
CREATE POLICY "Clientes veem seus próprios pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

CREATE POLICY "Master vê todos os pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "Clientes podem criar pedidos"
  ON pedidos FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Somente o sistema atualiza pedidos"
  ON pedidos FOR UPDATE
  TO authenticated
  USING (is_master());

-- ---- pedido_itens ----
CREATE POLICY "Cliente vê itens dos seus pedidos"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_itens.pedido_id AND p.cliente_id = auth.uid()
    )
  );

CREATE POLICY "Master vê todos os itens"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "Sistema insere itens de pedido"
  ON pedido_itens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_itens.pedido_id AND p.cliente_id = auth.uid()
    )
  );

-- ---- access_logs ----
CREATE POLICY "Inserção livre para usuários autenticados"
  ON access_logs FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Inserção para usuários anônimos via service role"
  ON access_logs FOR INSERT
  TO anon
  WITH CHECK (FALSE);  -- bloqueado via anon; usar service_role key no servidor

CREATE POLICY "Somente Master lê logs de acesso"
  ON access_logs FOR SELECT
  TO authenticated
  USING (is_master());

-- ---- consentimentos ----
CREATE POLICY "Qualquer um pode registrar consentimento"
  ON consentimentos FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Usuário vê seus próprios consentimentos"
  ON consentimentos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Master vê todos os consentimentos"
  ON consentimentos FOR SELECT
  TO authenticated
  USING (is_master());
