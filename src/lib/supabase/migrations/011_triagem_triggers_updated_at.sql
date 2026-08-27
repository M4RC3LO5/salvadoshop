-- 011_triagem_triggers_updated_at.sql
-- Mantem updated_at atualizado nas tabelas de triagem.
-- Reaproveita a funcao public.set_updated_at() ja existente no projeto.

create trigger trg_triagem_listas_updated_at
  before update on public.triagem_listas
  for each row execute function public.set_updated_at();

create trigger trg_estoque_itens_updated_at
  before update on public.estoque_itens
  for each row execute function public.set_updated_at();
