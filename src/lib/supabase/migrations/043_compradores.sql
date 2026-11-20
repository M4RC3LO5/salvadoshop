-- 043: compradores, segmentos e contador de buscas no Google (SS-01 etapa 1)

create table public.segmentos (
  id smallint generated always as identity primary key,
  nome text not null unique check (length(btrim(nome)) between 1 and 60),
  ordem smallint not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.segmentos (nome, ordem) values
  ('Cosméticos', 1),
  ('Higiene e limpeza', 2),
  ('Alimentos e bebidas', 3),
  ('Ferramentas', 4),
  ('Utilidades domésticas', 5),
  ('Eletrônicos', 6),
  ('Brinquedos', 7),
  ('Papelaria', 8),
  ('Outros', 99);

create table public.compradores (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (length(btrim(empresa)) between 1 and 200),
  pessoa_contato text check (length(pessoa_contato) <= 120),
  telefone text check (length(telefone) <= 30),
  celular text check (length(celular) <= 30),
  celular_whatsapp boolean not null default false,
  email text check (length(email) <= 200),
  endereco text check (length(endereco) <= 300),
  bairro text check (length(bairro) <= 120),
  cidade text check (length(cidade) <= 120),
  uf text check (uf ~ '^[A-Z]{2}$'),
  site text check (length(site) <= 300),
  status text not null default 'lead' check (status in ('lead', 'contato', 'cliente', 'descartado')),
  origem text not null check (origem in ('carteira', 'google', 'indicacao', 'grupo_marketplace')),
  google_place_id text unique,
  observacao text check (length(observacao) <= 2000),
  telefone_digitos text generated always as (nullif(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '')) stored,
  celular_digitos text generated always as (nullif(regexp_replace(coalesce(celular, ''), '\D', '', 'g'), '')) stored,
  criado_por uuid references public.admin_usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index compradores_status_idx on public.compradores (status);
create index compradores_telefone_digitos_idx on public.compradores (telefone_digitos);
create index compradores_celular_digitos_idx on public.compradores (celular_digitos);

create table public.compradores_segmentos (
  comprador_id uuid not null references public.compradores(id) on delete cascade,
  segmento_id smallint not null references public.segmentos(id),
  primary key (comprador_id, segmento_id)
);

create index compradores_segmentos_segmento_idx on public.compradores_segmentos (segmento_id);

create table public.google_buscas (
  id uuid primary key default gen_random_uuid(),
  termo text not null check (length(btrim(termo)) between 1 and 120),
  regiao text not null check (length(btrim(regiao)) between 1 and 120),
  segmento_id smallint references public.segmentos(id),
  resultados smallint not null default 0,
  criado_por uuid references public.admin_usuarios(id),
  created_at timestamptz not null default now()
);

create index google_buscas_created_at_idx on public.google_buscas (created_at);

-- Empresa sempre em CAIXA ALTA e updated_at automatico.
create or replace function public.compradores_normalizar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.empresa := upper(btrim(new.empresa));
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.compradores_normalizar() from public, anon, authenticated;

create trigger trg_compradores_normalizar
  before insert or update on public.compradores
  for each row execute function public.compradores_normalizar();

-- criado_por vem da sessao, nunca do cliente.
create or replace function public.set_criado_por_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  select a.id into new.criado_por from public.admin_usuarios a where a.user_id = auth.uid();
  return new;
end;
$$;

revoke execute on function public.set_criado_por_admin() from public, anon, authenticated;

create trigger trg_compradores_criado_por
  before insert on public.compradores
  for each row execute function public.set_criado_por_admin();

create trigger trg_google_buscas_criado_por
  before insert on public.google_buscas
  for each row execute function public.set_criado_por_admin();

-- Buscas feitas no mes corrente (fuso de Sao Paulo), para o contador de 1.000/mes.
create or replace function public.google_buscas_no_mes()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer
  from public.google_buscas
  where created_at >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;

revoke execute on function public.google_buscas_no_mes() from public, anon;
grant execute on function public.google_buscas_no_mes() to authenticated;

-- RLS: Master e Auxiliar operam; apagar comprador e mexer em segmentos so Master.
alter table public.segmentos enable row level security;
alter table public.compradores enable row level security;
alter table public.compradores_segmentos enable row level security;
alter table public.google_buscas enable row level security;

create policy segmentos_select on public.segmentos for select to authenticated using (public.is_admin());
create policy segmentos_insert on public.segmentos for insert to authenticated with check (public.is_master());
create policy segmentos_update on public.segmentos for update to authenticated using (public.is_master()) with check (public.is_master());
create policy segmentos_delete on public.segmentos for delete to authenticated using (public.is_master());

create policy compradores_select on public.compradores for select to authenticated using (public.is_admin());
create policy compradores_insert on public.compradores for insert to authenticated with check (public.is_admin());
create policy compradores_update on public.compradores for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy compradores_delete on public.compradores for delete to authenticated using (public.is_master());

create policy compradores_segmentos_select on public.compradores_segmentos for select to authenticated using (public.is_admin());
create policy compradores_segmentos_insert on public.compradores_segmentos for insert to authenticated with check (public.is_admin());
create policy compradores_segmentos_delete on public.compradores_segmentos for delete to authenticated using (public.is_admin());

create policy google_buscas_select on public.google_buscas for select to authenticated using (public.is_admin());
create policy google_buscas_insert on public.google_buscas for insert to authenticated with check (public.is_admin());
