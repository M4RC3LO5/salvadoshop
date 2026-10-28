-- 039: quem alterou por ultimo cada item da triagem (SS-14)
alter table public.estoque_itens
  add column atualizado_por uuid references public.admin_usuarios(id),
  add column atualizado_em timestamptz;

-- Grava quem alterou e quando, so se mudou algum campo de verdade.
-- Reordenar (ordem) nao conta. Cliente nao consegue escrever esses campos.
create or replace function public.set_atualizado_por_estoque_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  -- total_unidades e GENERATED: em BEFORE UPDATE vem NULL em NEW, por isso fica fora.
  if (to_jsonb(new) - array['ordem','updated_at','total_unidades','atualizado_por','atualizado_em'])
     is not distinct from
     (to_jsonb(old) - array['ordem','updated_at','total_unidades','atualizado_por','atualizado_em']) then
    new.atualizado_por := old.atualizado_por;
    new.atualizado_em := old.atualizado_em;
    return new;
  end if;
  select a.id into v_admin from public.admin_usuarios a where a.user_id = auth.uid();
  new.atualizado_por := v_admin;
  new.atualizado_em := now();
  return new;
end;
$$;

revoke execute on function public.set_atualizado_por_estoque_item() from public, anon, authenticated;

create trigger trg_estoque_itens_atualizado_por
  before update on public.estoque_itens
  for each row execute function public.set_atualizado_por_estoque_item();

-- Nome dos admins para exibir na triagem (so id e nome, so para admin).
create or replace function public.nomes_admin(p_ids uuid[])
returns table(id uuid, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.nome
  from public.admin_usuarios a
  where a.id = any(p_ids) and public.is_admin();
$$;

revoke execute on function public.nomes_admin(uuid[]) from public, anon;
grant execute on function public.nomes_admin(uuid[]) to authenticated;
