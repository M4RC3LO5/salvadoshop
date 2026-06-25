-- ============================================================
-- SalvadoShop — Seed de desenvolvimento
-- Migração: 002_seed_desenvolvimento.sql
-- Criado em: 2026-06-25
-- ATENÇÃO: apenas para ambiente de desenvolvimento/teste
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

-- Produto A-1: TV 55" 4K Samsung (sinistro de transportadora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000001',
  'Smart TV Samsung 55" 4K Crystal UHD',
  'smart-tv-samsung-55-4k-crystal-uhd',
  'Smart TV Samsung 55 polegadas com resolução 4K Crystal UHD. Produto salvado de sinistro de transportadora — caixa com avaria leve, produto em perfeito estado de funcionamento. Acompanha controle remoto, cabos e nota fiscal de origem.',
  '{"marca": "Samsung", "modelo": "UN55CU7700", "tamanho": "55\"", "resolucao": "4K UHD (3840x2160)", "sistema": "Tizen OS", "conectividade": ["Wi-Fi", "Bluetooth 5.0", "HDMI x3", "USB x2"], "hdr": "HDR10+", "taxa_atualizacao": "60Hz", "garantia_salvado": "3 meses"}',
  'tipo_a',
  2199.90,
  'publicado',
  'Eletronicos',
  'Sinistro de transportadora — caixa com amassado lateral, produto sem danos',
  1,
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- Produto A-2: Notebook Dell Inspiron (leilão Receita Federal)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000002',
  'Notebook Dell Inspiron 15 Core i5 8GB RAM 256GB SSD',
  'notebook-dell-inspiron-15-i5-8gb-256ssd',
  'Notebook Dell Inspiron 15 apreendido em leilão da Receita Federal. Produto em excelente estado, sem marcas de uso. Bateria com 92% de capacidade original. Ideal para trabalho e estudos.',
  '{"marca": "Dell", "modelo": "Inspiron 3511", "processador": "Intel Core i5-1135G7", "ram": "8GB DDR4", "armazenamento": "256GB SSD NVMe", "tela": "15.6\" Full HD", "sistema": "Sem SO (licença Windows pode ser adquirida separadamente)", "bateria": "3 células 41Wh", "peso": "1.8kg", "garantia_salvado": "3 meses"}',
  'tipo_a',
  2849.00,
  'publicado',
  'Informatica',
  'Leilão Receita Federal — apreensão de carga não declarada',
  2,
  'a1b2c3d4-0000-4000-8000-000000000001',
  'a1b2c3d4-0000-4000-8000-000000000001'
);

-- Produto A-3: Geladeira Brastemp Frost Free (sinistro de seguradora)
INSERT INTO produtos (
  id, nome, slug, descricao, specs_tecnicas, tipo,
  preco_ml, status, categoria, sinistro, estoque,
  criado_por, aprovado_por
)
VALUES (
  'b1000000-0000-4000-8000-000000000003',
  'Geladeira Brastemp Frost Free 375L Inox BRM44HK',
  'geladeira-brastemp-frost-free-375l-inox-brm44hk',
  'Geladeira Brastemp Frost Free 375 litros em aço inox. Salvada de sinistro de seguradora após incêndio parcial em loja — produto completamente intacto, apenas a embalagem foi afetada pela fumaça. Compressor e sistema de refrigeração em pleno funcionamento, testado e aprovado pela nossa equipe técnica.',
  '{"marca": "Brastemp", "modelo": "BRM44HK", "capacidade": "375 litros", "tipo": "Frost Free", "acabamento": "Inox", "voltagem": "220V", "consumo_energetico": "A (388 kWh/ano)", "dimensoes": "1,67m x 68cm x 73cm", "prateleiras": "3 prateleiras de vidro", "gavetas": "2 gavetões para legumes", "garantia_salvado": "6 meses compressor"}',
  'tipo_a',
  3190.00,
  'publicado',
  'Eletrodomesticos',
  'Sinistro de seguradora — incêndio em loja, produto sem danos físicos',
  1,
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
  '{"composicao_estimada": {"funcionando_100pct": "28 unidades", "tela_trincada": "8 unidades", "para_pecas": "4 unidades"}, "marcas": ["Samsung", "Motorola", "Xiaomi"], "modelos_estimados": "Linhas intermediárias 2022-2024", "inspecao": "Disponível mediante agendamento", "nota_fiscal_lote": true}',
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
  '{"itens": [{"tipo": "Maquina de lavar", "quantidade": 6, "marcas": ["Brastemp", "Consul"]}, {"tipo": "Micro-ondas", "quantidade": 5, "marcas": ["Electrolux", "Philco"]}, {"tipo": "Fogao 4 bocas", "quantidade": 4, "marcas": ["Consul", "Atlas"]}], "status_geral": {"perfeito_funcionamento": 12, "defeito_cosmetico": 3}, "laudo_tecnico": true, "inspecao": "Disponível mediante agendamento em nosso galpão"}',
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
