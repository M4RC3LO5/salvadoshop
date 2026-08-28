-- 016_triagem_rls_restringe_admin.sql
-- As tabelas da triagem usavam politicas genericas (using true), liberando
-- leitura e escrita para qualquer usuario autenticado, inclusive clientes da loja.
-- Passam a exigir admin ativo, seguindo o padrao ja usado em produtos/pedidos.

drop policy if exists "usuarios autenticados leem itens" on public.estoque_itens;
drop policy if exists "usuarios autenticados gerenciam itens" on public.estoque_itens;
drop policy if exists "usuarios autenticados leem listas" on public.triagem_listas;
drop policy if exists "usuarios autenticados gerenciam listas" on public.triagem_listas;
drop policy if exists "usuarios autenticados leem ligacoes" on public.estoque_item_produtos;
drop policy if exists "usuarios autenticados gerenciam ligacoes" on public.estoque_item_produtos;

create policy "Admins veem itens de estoque"
  on public.estoque_itens for select to authenticated using (is_admin());
create policy "Admins gerenciam itens de estoque"
  on public.estoque_itens for all to authenticated using (is_admin()) with check (is_admin());

create policy "Admins veem listas de triagem"
  on public.triagem_listas for select to authenticated using (is_admin());
create policy "Admins gerenciam listas de triagem"
  on public.triagem_listas for all to authenticated using (is_admin()) with check (is_admin());

create policy "Admins veem ligacoes de publicacao"
  on public.estoque_item_produtos for select to authenticated using (is_admin());
create policy "Admins gerenciam ligacoes de publicacao"
  on public.estoque_item_produtos for all to authenticated using (is_admin()) with check (is_admin());
