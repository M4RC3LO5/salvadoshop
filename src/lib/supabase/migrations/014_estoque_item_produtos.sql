-- Liga itens triados (estoque_itens) aos produtos publicados na vitrine (produtos).
-- Um item pode virar um produto individual (tipo_a) OU compor um lote (tipo_b),
-- nunca os dois ao mesmo tempo — o índice parcial abaixo garante no máximo
-- uma ligação ATIVA por item, para impedir venda dupla do mesmo estoque.

create table estoque_item_produtos (
  id uuid primary key default gen_random_uuid(),
  estoque_item_id uuid not null references estoque_itens(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (estoque_item_id, produto_id)
);

-- No máximo uma ligação ativa por item de estoque
create unique index estoque_item_produtos_item_ativo_idx
  on estoque_item_produtos (estoque_item_id)
  where ativo;

create index estoque_item_produtos_estoque_item_id_idx on estoque_item_produtos (estoque_item_id);
create index estoque_item_produtos_produto_id_idx on estoque_item_produtos (produto_id);

alter table estoque_item_produtos enable row level security;

create policy "usuarios autenticados leem ligacoes"
  on estoque_item_produtos for select
  to authenticated
  using (true);

create policy "usuarios autenticados gerenciam ligacoes"
  on estoque_item_produtos for all
  to authenticated
  using (true)
  with check (true);
