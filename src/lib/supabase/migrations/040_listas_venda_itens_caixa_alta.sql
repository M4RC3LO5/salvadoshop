-- 040: descricao e fabricante da lista de venda em CAIXA ALTA (SS-12)
-- Vale para INSERT e para UPDATE desses dois campos. Linhas existentes so
-- mudam quando o campo for editado.
create or replace function public.maiusculas_lista_venda_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.descricao := upper(new.descricao);
  new.fabricante := upper(new.fabricante);
  return new;
end;
$$;

revoke execute on function public.maiusculas_lista_venda_item() from public, anon, authenticated;

create trigger trg_listas_venda_itens_maiusculas
  before insert or update of descricao, fabricante on public.listas_venda_itens
  for each row execute function public.maiusculas_lista_venda_item();
