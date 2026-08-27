-- 010_triagem_estoque_itens.sql
-- Tabelas base da funcionalidade de Triagem de Estoque.
-- Aplicada em producao via execute_sql (fora do historico de migrations do Supabase).
-- Este arquivo existe para manter o repositorio reproduzivel.

-- ENUMs
create type tipo_captura as enum ('etiqueta', 'item_avulso');
create type origem_item as enum ('sinistro', 'fabricante', 'ecommerce', 'atacado', 'avulso');
create type estado_item as enum ('lacrado', 'avaria_leve', 'avaria_grave', 'sucata');

-- Listas de triagem
create table public.triagem_listas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criado_por  uuid not null references public.admin_usuarios(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Itens triados
create table public.estoque_itens (
  id                 uuid primary key default gen_random_uuid(),
  lista_id           uuid references public.triagem_listas(id) on delete set null,
  ordem              integer not null default 0,

  foto_url           text not null,
  tipo_captura       tipo_captura not null,

  nome               text not null,
  marca              text,
  sku                text,
  ean                text,

  qtd_embalagem      integer not null default 1 check (qtd_embalagem > 0),
  num_caixas         integer not null default 1 check (num_caixas > 0),
  total_unidades     integer generated always as (qtd_embalagem * num_caixas) stored,

  lote               text,
  validade           date,

  estado             estado_item,
  estado_livre       text,
  observacoes        text,

  custo_unitario     numeric(12,2),
  origem             origem_item,
  fornecedor         text,

  campos_ia          jsonb,

  data_entrada       date not null default current_date,
  criado_por         uuid not null references public.admin_usuarios(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_estoque_itens_lista on public.estoque_itens(lista_id, ordem);
create index idx_estoque_itens_ean on public.estoque_itens(ean);
create index idx_estoque_itens_nome on public.estoque_itens using gin (to_tsvector('portuguese', nome));

-- RLS
alter table public.triagem_listas enable row level security;
alter table public.estoque_itens enable row level security;

create policy "usuarios autenticados leem listas"
  on public.triagem_listas for select to authenticated using (true);
create policy "usuarios autenticados gerenciam listas"
  on public.triagem_listas for all to authenticated using (true) with check (true);

create policy "usuarios autenticados leem itens"
  on public.estoque_itens for select to authenticated using (true);
create policy "usuarios autenticados gerenciam itens"
  on public.estoque_itens for all to authenticated using (true) with check (true);
