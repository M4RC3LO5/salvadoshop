-- ============================================================
-- SalvadoShop — Seed de desenvolvimento
-- Migração: 002_seed_desenvolvimento.sql
-- Criado em: 2026-06-25
-- ATENÇÃO: apenas para ambiente de desenvolvimento/teste
--
-- NOTA (item 25 do BACKLOG.md, corrigido em 2026-09-10): os 3 produtos
-- tipo_a individuais nasciam sem url_ml. A migration 021 faz backfill de
-- exclusivo_site = (url_ml IS NULL) — sem url_ml eles viravam
-- "exclusivo_site = true" — e a 022 exige preco_venda preenchido para todo
-- tipo_a publicado exclusivo, que o seed nunca preenchia. Resultado: a
-- sequência completa (001→025) não rodava em banco novo, quebrando na 022.
--
-- Corrigido preenchendo url_ml nos 3 produtos, para nascerem não-exclusivos
-- (mesmo padrão dos produtos reais em produção hoje) — não precisam de
-- preco_venda, e a 025 (preco_site < preco_ml) já é satisfeita pelo cálculo
-- automático de 18% da própria migration 001.
--
-- A coluna url_ml só é criada pela migration "add_rascunho_status_and_url_ml"
-- (roda depois da 002 na sequência real, 2026-06-26) — nesta migration (002)
-- ela ainda não existe. Por isso o ALTER TABLE ADD COLUMN IF NOT EXISTS
-- abaixo, antes dos INSERTs: cria a coluna cedo, de forma idempotente — o
-- ADD COLUMN IF NOT EXISTS daquela migration mais tarde vira no-op, sem
-- conflito. Sem esse passo, o INSERT com url_ml quebraria com "column
-- url_ml does not exist" antes mesmo de chegar na 021/022.
--
-- Não afeta produção: nenhum dos produtos deste seed (ids b1000000-...)
-- existe em produção — os produtos reais foram cadastrados depois,
-- manualmente, pelo admin.
--
-- NOTA (item 27 do BACKLOG.md, corrigido em 2026-09-29): os produtos do
-- seed não podiam ser salvos pela tela de edição do admin
-- (NovoProdutoForm.tsx). Dois motivos:
--   1. specs_tecnicas era gravado como objeto livre ({"marca": ...}),
--      mas a tela lê e a API grava sempre {"texto": "<string>"} — o
--      campo abria vazio e bloqueava o salvar (especificações
--      obrigatórias). Convertido para {"texto": ...}, com o conteúdo
--      anterior reescrito em texto legível, sem perda de informação.
--   2. Nenhuma linha em produto_imagens — o form exige ao menos 1
--      imagem. Adicionada 1 imagem por produto (seção 4, no fim).
-- ============================================================

-- ============================================================
-- 1. ADMIN MASTER DE TESTE
-- user_id fictício — substituir pelo UUID real do Supabase Auth
-- antes de usar em produção
-- ============================================================

INSERT INTO admin_usuarios (id, user_id, role, nome, email, ativo)
VALUES (
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000099',  -- UUID fictício (auth.users)
  'master',
  'Marcelo (Master)',
  'm4rc3lo5@gmail.com',
  TRUE
);

-- ============================================================
-- 2. PRODUTOS TIPO A — Individuais com preço ML + desconto 18%
-- preco_site é GERADO automaticamente: ROUND(preco_ml * 0.82, 2)
-- ============================================================

-- url_ml normalmente só existe a partir da migration
-- "add_rascunho_status_and_url_ml" (2026-06-26). Criada aqui cedo, de forma
-- idempotente, só para os 3 INSERTs abaixo poderem preencher o campo —
-- ver nota no cabeçalho do arquivo.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS url_ml TEXT;

-- Produto A-1: TV 55" 4K Samsung (sinistro de transportadora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque, url_ml,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000001',
  'Smart TV Samsung 55" 4K Crystal UHD',
  'smart-tv-samsung-55-4k-crystal-uhd',
  'Smart TV Samsung 55 polegadas com resolução 4K Crystal UHD. Produto salvado de sinistro de transportadora — caixa com avaria leve, produto em perfeito estado de funcionamento. Acompanha controle remoto, cabos e nota fiscal de origem.',
  '{"texto": "Marca: Samsung\nModelo: UN55CU7700\nTamanho: 55\"\nResolução: 4K UHD (3840x2160)\nSistema: Tizen OS\nConectividade: Wi-Fi, Bluetooth 5.0, HDMI x3, USB x2\nHDR: HDR10+\nTaxa de atualização: 60Hz\nGarantia do salvado: 3 meses"}',
  'tipo_a',
  2199.90,
  'publicado',
  'Eletronicos',
  'Sinistro de transportadora — caixa com amassado lateral, produto sem danos',
  1,
  'https://www.mercadolivre.com.br/smart-tv-samsung-55-4k-crystal-uhd/p/MLB1234561',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- Produto A-2: Notebook Dell Inspiron (leilão Receita Federal)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque, url_ml,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000002',
  'Notebook Dell Inspiron 15 Core i5 8GB RAM 256GB SSD',
  'notebook-dell-inspiron-15-i5-8gb-256ssd',
  'Notebook Dell Inspiron 15 apreendido em leilão da Receita Federal. Produto em excelente estado, sem marcas de uso. Bateria com 92% de capacidade original. Ideal para trabalho e estudos.',
  '{"texto": "Marca: Dell\nModelo: Inspiron 3511\nProcessador: Intel Core i5-1135G7\nRAM: 8GB DDR4\nArmazenamento: 256GB SSD NVMe\nTela: 15.6\" Full HD\nSistema: Sem SO (licença Windows pode ser adquirida separadamente)\nBateria: 3 células 41Wh\nPeso: 1.8kg\nGarantia do salvado: 3 meses"}',
  'tipo_a',
  2849.00,
  'publicado',
  'Informatica',
  'Leilão Receita Federal — apreensão de carga não declarada',
  2,
  'https://www.mercadolivre.com.br/notebook-dell-inspiron-15-i5-8gb-256ssd/p/MLB1234562',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- Produto A-3: Geladeira Brastemp Frost Free (sinistro de seguradora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque, url_ml,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000003',
  'Geladeira Brastemp Frost Free 375L Inox BRM44HK',
  'geladeira-brastemp-frost-free-375l-inox-brm44hk',
  'Geladeira Brastemp Frost Free 375 litros em aço inox. Salvada de sinistro de seguradora após incêndio parcial em loja — produto completamente intacto, apenas a embalagem foi afetada pela fumaça. Compressor e sistema de refrigeração em pleno funcionamento, testado e aprovado pela nossa equipe técnica.',
  '{"texto": "Marca: Brastemp\nModelo: BRM44HK\nCapacidade: 375 litros\nTipo: Frost Free\nAcabamento: Inox\nVoltagem: 220V\nConsumo energético: A (388 kWh/ano)\nDimensões: 1,67m x 68cm x 73cm\nPrateleiras: 3 prateleiras de vidro\nGavetas: 2 gavetões para legumes\nGarantia do salvado: 6 meses compressor"}',
  'tipo_a',
  3190.00,
  'publicado',
  'Eletrodomesticos',
  'Sinistro de seguradora — incêndio em loja, produto sem danos físicos',
  1,
  'https://www.mercadolivre.com.br/geladeira-brastemp-frost-free-375l-inox-brm44hk/p/MLB1234563',
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- ============================================================
-- 3. PRODUTOS TIPO B — Lotes para revendedores (sem preco_ml)
-- Negociação via WhatsApp — sem preço fixo
-- ============================================================

-- Lote B-1: Smartphones variados (leilão transportadora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque, quantidade_lote,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000004',
  'Lote 40 Smartphones Variados — Sinistro Transportadora',
  'lote-40-smartphones-variados-sinistro-transportadora',
  'Lote com 40 smartphones de marcas variadas (Samsung, Motorola, Xiaomi) adquiridos de sinistro de transportadora. Aproximadamente 70% dos aparelhos em funcionamento total, 20% com tela trincada e 10% para retirada de peças. Composição exata disponível para inspeção antes da negociação. Ideal para lojas de reparo, revendedores de usados ou investidores.',
  '{"texto": "Composição estimada:\n- Funcionando 100%: 28 unidades\n- Tela trincada: 8 unidades\n- Para peças: 4 unidades\nMarcas: Samsung, Motorola, Xiaomi\nModelos estimados: Linhas intermediárias 2022-2024\nInspeção: Disponível mediante agendamento\nNota fiscal do lote: Sim"}',
  'tipo_b',
  NULL,
  'publicado',
  'Eletronicos',
  'Sinistro de transportadora — carga avariada em acidente rodoviário',
  40,
  40,
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- Lote B-2: Eletrodomésticos de linha branca (leilão seguradora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque, quantidade_lote,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000005',
  'Lote 15 Eletrodomésticos Linha Branca — Leilão Seguradora',
  'lote-15-eletrodomesticos-linha-branca-leilao-seguradora',
  'Lote com 15 eletrodomésticos de linha branca (máquinas de lavar, micro-ondas e fogões) adquiridos em leilão de seguradora após sinistro em centro de distribuição. Todos os produtos foram avaliados: 12 em perfeito funcionamento, 3 com defeitos cosméticos leves. Acompanha laudo técnico individual de cada item. Excelente oportunidade para lojistas e revendedores.',
  '{"texto": "Itens:\n- Maquina de lavar: 6 unidades (Brastemp, Consul)\n- Micro-ondas: 5 unidades (Electrolux, Philco)\n- Fogao 4 bocas: 4 unidades (Consul, Atlas)\nStatus geral:\n- Perfeito funcionamento: 12\n- Defeito cosmético: 3\nLaudo técnico: Sim\nInspeção: Disponível mediante agendamento em nosso galpão"}',
  'tipo_b',
  NULL,
  'publicado',
  'Eletrodomesticos',
  'Leilão de seguradora — sinistro em centro de distribuição',
  15,
  15,
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- ============================================================
-- 4. IMAGENS DOS PRODUTOS DO SEED (item 27 do BACKLOG.md)
-- Todos usam a mesma imagem de teste do Cloudinary (não é imagem de
-- produção). O public_id é FICTÍCIO de propósito, único por linha e
-- diferente do public_id real da imagem ("Imagem1"): as rotas de
-- exclusão chamam destroy no Cloudinary pelo public_id; com id
-- fictício, excluir imagem/produto no ambiente de desenvolvimento não
-- apaga a imagem real da conta compartilhada. Ver também 18.7 do
-- CLAUDE.md (public_id é UNIQUE global).
-- ============================================================

INSERT INTO produto_imagens (produto_id, url_cloudinary, public_id, ordem)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'https://res.cloudinary.com/dtuclb3q1/image/upload/v1790639988/Imagem1.jpg', 'seed-dev/fake-produto-1', 0),
  ('b1000000-0000-4000-8000-000000000002', 'https://res.cloudinary.com/dtuclb3q1/image/upload/v1790639988/Imagem1.jpg', 'seed-dev/fake-produto-2', 0),
  ('b1000000-0000-4000-8000-000000000003', 'https://res.cloudinary.com/dtuclb3q1/image/upload/v1790639988/Imagem1.jpg', 'seed-dev/fake-produto-3', 0),
  ('b1000000-0000-4000-8000-000000000004', 'https://res.cloudinary.com/dtuclb3q1/image/upload/v1790639988/Imagem1.jpg', 'seed-dev/fake-produto-4', 0),
  ('b1000000-0000-4000-8000-000000000005', 'https://res.cloudinary.com/dtuclb3q1/image/upload/v1790639988/Imagem1.jpg', 'seed-dev/fake-produto-5', 0);
