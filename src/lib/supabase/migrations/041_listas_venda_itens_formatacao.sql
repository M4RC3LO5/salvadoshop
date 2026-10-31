-- 041: formatacao por celula na lista de venda (SS-13)
-- Ex.: {"descricao": {"n": true, "t": true}} = descricao em negrito e tachado.
-- Chaves de coluna: descricao, fabr, ref, vencto, qtd, und, cx, total.
-- Estilos: n = negrito, i = italico, s = sublinhado, t = tachado.
alter table public.listas_venda_itens
  add column formatacao jsonb not null default '{}'::jsonb;

alter table public.listas_venda_itens
  add constraint chk_listas_venda_itens_formatacao_objeto
  check (jsonb_typeof(formatacao) = 'object');
