-- 035_anuncios_ia: fila de rascunhos gerados por IA a partir de fotos.
-- Tabela isolada: nao altera nenhuma tabela existente.

create table public.anuncios_ia (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'enviado'
    check (status in ('enviado','processando','pronto','erro','convertido','descartado')),
  imagens jsonb not null default '[]'::jsonb check (jsonb_typeof(imagens) = 'array'),
  dados_ia jsonb check (dados_ia is null or jsonb_typeof(dados_ia) = 'object'),
  fontes jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array'),
  alertas jsonb not null default '[]'::jsonb check (jsonb_typeof(alertas) = 'array'),
  modelo text,
  tokens_entrada integer check (tokens_entrada >= 0),
  tokens_saida integer check (tokens_saida >= 0),
  custo_usd numeric(10,6) check (custo_usd >= 0),
  erro_mensagem text,
  produto_id uuid references public.produtos(id) on delete set null,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index anuncios_ia_status_created_idx on public.anuncios_ia (status, created_at desc);

create trigger trg_anuncios_ia_updated_at
  before update on public.anuncios_ia
  for each row execute function public.set_updated_at();

alter table public.anuncios_ia enable row level security;

create policy "Admins veem anuncios ia" on public.anuncios_ia
  for select to authenticated using (is_admin());
create policy "Admins inserem anuncios ia" on public.anuncios_ia
  for insert to authenticated with check (is_admin());
create policy "Admins atualizam anuncios ia" on public.anuncios_ia
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins excluem anuncios ia" on public.anuncios_ia
  for delete to authenticated using (is_admin());

revoke all on public.anuncios_ia from public, anon, authenticated;
grant select, insert, update, delete on public.anuncios_ia to authenticated;
grant all on public.anuncios_ia to service_role;
