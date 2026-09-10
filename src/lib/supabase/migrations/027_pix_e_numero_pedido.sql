-- ============================================================
-- SalvadoShop — dados Pix da loja e número sequencial do pedido
-- Migração: 027_pix_e_numero_pedido.sql
--
-- DOCUMENTAÇÃO RETROATIVA — NÃO APLICAR.
-- Esta migration já está em produção. Foi aplicada em 2026-08-28
-- (registrada no histórico do Supabase como "017_pix_e_numero_pedido",
-- versão 20260828104307), mas o arquivo correspondente nunca foi
-- criado no repositório — achado durante a investigação do item 20 do
-- BACKLOG.md (histórico de migrations fora de sincronia). O conteúdo
-- abaixo é o SQL exato recuperado de
-- supabase_migrations.schema_migrations.statements, não uma
-- reconstrução por inferência.
-- ============================================================

-- Remocao do Stripe: pagamento passa a ser Pix (chave fixa + QR estatico)
-- e link de cartao gerado manualmente pelo banco, enviado por WhatsApp.

-- 1) Dados do beneficiario Pix, editaveis pelo admin
alter table public.configuracoes_loja
  add column if not exists pix_chave text,
  add column if not exists pix_tipo_chave text,
  add column if not exists pix_beneficiario text,
  add column if not exists pix_cidade text;

update public.configuracoes_loja
set pix_chave = 'm4rc3lo5@gmail.com',
    pix_tipo_chave = 'email',
    pix_beneficiario = 'MARCELO NOGUEIRA',
    pix_cidade = 'SAO PAULO',
    updated_at = now();

-- 2) Numero sequencial legivel do pedido.
-- O UUID nao serve para o cliente informar nem para conciliar no extrato.
create sequence if not exists public.pedidos_numero_seq start 1000;

alter table public.pedidos
  add column if not exists numero_pedido integer;

alter table public.pedidos
  alter column numero_pedido set default nextval('public.pedidos_numero_seq');

-- preenche pedidos existentes (hoje nao ha nenhum)
update public.pedidos
set numero_pedido = nextval('public.pedidos_numero_seq')
where numero_pedido is null;

alter table public.pedidos
  alter column numero_pedido set not null;

create unique index if not exists idx_pedidos_numero on public.pedidos(numero_pedido);

comment on column public.pedidos.numero_pedido is
  'Numero sequencial legivel. Os dois ultimos digitos servem como identificador '
  'nos centavos do valor do Pix, permitindo conciliacao pelo extrato.';
