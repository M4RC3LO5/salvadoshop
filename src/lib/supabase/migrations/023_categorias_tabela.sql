-- Item 14 do backlog: criação dinâmica de categorias.
-- Categoria deixa de ser só uma coluna text em produtos e vira entidade
-- própria, com FK em produtos. A coluna produtos.categoria antiga é mantida
-- por enquanto (não removida) — telas que ainda não migraram continuam
-- funcionando. A remoção da coluna antiga fica para um item de backlog
-- futuro, depois que a vitrine passar a ler de categoria_id.

create extension if not exists unaccent with schema extensions;

-- Slugify determinístico (minúsculo, sem acento, não-alfanumérico vira "-",
-- sem hífen nas pontas) — mesma regra usada no dedup de categorias na rota
-- POST /api/admin/categorias, para o backfill abaixo bater com o que a API
-- vai gerar dali em diante.
create or replace function public.slugify(texto text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select trim(both '-' from
    regexp_replace(lower(extensions.unaccent(texto)), '[^a-z0-9]+', '-', 'g')
  )
$$;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categorias enable row level security;

create policy "Admins veem todas as categorias"
  on public.categorias for select
  using (is_admin());

create policy "Somente Master cria categorias"
  on public.categorias for insert
  with check (is_master());

alter table public.produtos
  add column if not exists categoria_id uuid references public.categorias(id);

create index if not exists idx_produtos_categoria_id on public.produtos (categoria_id);

-- Backfill: uma categoria por valor distinto hoje existente em produtos.categoria.
insert into public.categorias (nome, slug)
select distinct on (public.slugify(categoria))
  trim(categoria),
  public.slugify(categoria)
from public.produtos
where categoria is not null and trim(categoria) <> ''
order by public.slugify(categoria), categoria
on conflict (slug) do nothing;

update public.produtos p
set categoria_id = c.id
from public.categorias c
where c.slug = public.slugify(p.categoria)
  and p.categoria is not null
  and trim(p.categoria) <> ''
  and p.categoria_id is null;
