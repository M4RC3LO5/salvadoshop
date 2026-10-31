-- ============================================================
-- SalvadoShop — template de especificações por categoria
-- Migração: 031_template_campos.sql
--
-- Contexto: até aqui, specs técnicas de produto vivem soltas em
-- produtos.specs_tecnicas (jsonb livre, sem forma definida). Esta migração
-- cria a modelagem de TEMPLATE — quais campos de especificação existem para
-- cada categoria, com rótulo, grupo, tipo, unidade, ordem de exibição e uma
-- condição de exibição genérica (um campo pode depender do valor de outro
-- campo do mesmo template). O template mora no banco, não no código, e as
-- chaves de campo são snake_case fixas.
--
-- Escopo desta migração é só banco: nenhuma tela, formulário ou a coluna
-- produtos.specs_tecnicas são alterados aqui.
--
-- Auditoria de constraints (lição 18.10, direto do banco de produção):
-- categorias (023_categorias_tabela.sql) não tem nenhuma constraint que
-- precise ser revisitada por esta migração — template_campos é tabela nova,
-- sem alteração em tabela existente além da FK para categorias(id).
--
-- Migração aditiva (lição 18.9): cria tabela nova, não toca em nenhuma
-- coluna ou constraint que código em produção já leia ou escreva. Pode ser
-- aplicada antes do deploy do código que eventualmente vier a consumi-la.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela de campos de template
-- ------------------------------------------------------------

create table public.template_campos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  chave text not null,
  rotulo text not null,
  grupo text not null,
  tipo text not null,
  unidade text,
  opcoes jsonb,
  ordem integer not null default 0,
  campo_dependencia text,
  valores_dependencia jsonb,
  created_at timestamptz not null default now(),

  constraint template_campos_categoria_chave_key unique (categoria_id, chave),

  constraint chk_template_campos_tipo
    check (tipo in ('texto', 'numero', 'booleano', 'selecao')),

  -- opcoes é obrigatório (lista não vazia) só para tipo = 'selecao';
  -- para os demais tipos a coluna fica sempre nula.
  constraint chk_template_campos_opcoes
    check (
      (tipo = 'selecao'
        and opcoes is not null
        and jsonb_typeof(opcoes) = 'array'
        and jsonb_array_length(opcoes) > 0)
      or
      (tipo <> 'selecao' and opcoes is null)
    ),

  -- Condição de exibição genérica: ou o campo não depende de nada (as duas
  -- colunas nulas), ou depende do valor de outro campo do mesmo template
  -- (chave do campo + lista não vazia de valores que tornam este campo
  -- visível). Nenhuma regra específica de produto é gravada aqui — a
  -- dependência real (ex.: "sem_fio") é dado de seed, não de schema.
  constraint chk_template_campos_dependencia
    check (
      (campo_dependencia is null and valores_dependencia is null)
      or
      (campo_dependencia is not null
        and valores_dependencia is not null
        and jsonb_typeof(valores_dependencia) = 'array'
        and jsonb_array_length(valores_dependencia) > 0)
    ),

  constraint chk_template_campos_dependencia_nao_propria
    check (campo_dependencia is distinct from chave)
);

create index idx_template_campos_categoria_ordem
  on public.template_campos (categoria_id, ordem);

comment on table public.template_campos is
  'Template de campos de especificação por categoria. Chave, rótulo, grupo, tipo, unidade, ordem e condição de exibição — o template mora no banco, não no código.';
comment on column public.template_campos.campo_dependencia is
  'Chave de outro campo do mesmo template (mesma categoria_id) do qual este campo depende para ser exibido. Nulo = sempre visível.';
comment on column public.template_campos.valores_dependencia is
  'Array jsonb dos valores de campo_dependencia que tornam este campo visível. Sempre não nulo quando campo_dependencia é preenchido.';

-- Valida que campo_dependencia aponta para uma chave que existe no mesmo
-- template (mesma categoria_id). Não dá para expressar isso como FK comum
-- porque a referência é por (categoria_id, chave), não por id, e chave não
-- é a coluna referenciada pela unique constraint nessa ordem.
create or replace function public.valida_dependencia_template_campo()
returns trigger
language plpgsql
as $$
begin
  if new.campo_dependencia is not null then
    if not exists (
      select 1 from public.template_campos
      where categoria_id = new.categoria_id
        and chave = new.campo_dependencia
    ) then
      raise exception
        'campo_dependencia "%" nao existe no template da categoria %',
        new.campo_dependencia, new.categoria_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_valida_dependencia_template_campo
  before insert or update on public.template_campos
  for each row execute function public.valida_dependencia_template_campo();

-- ------------------------------------------------------------
-- 2. RLS — leitura pública (mesmo padrão da migração 029 para categorias),
--    escrita somente Master.
-- ------------------------------------------------------------

alter table public.template_campos enable row level security;

-- GRANT explícito necessário além da policy: tabelas criadas via migration
-- (role postgres) não herdam privilégio de SELECT para anon/authenticated
-- por default privilege neste projeto — só objetos criados pelo role
-- supabase_admin herdam isso automaticamente (conferido em
-- pg_default_acl). categorias e produtos têm SELECT liberado para anon em
-- produção, mas esse GRANT nunca foi registrado em nenhuma migration do
-- repositório (concedido fora de banda, provavelmente via Studio) — sem
-- esta linha, a policy "using (true)" abaixo nunca seria alcançada: o
-- Postgres nega no nível de GRANT antes de avaliar RLS.
grant select on public.template_campos to anon, authenticated;

create policy "Template de campos é visível para todos"
  on public.template_campos for select
  using (true);

create policy "Somente Master cria campos de template"
  on public.template_campos for insert
  with check (is_master());

create policy "Somente Master edita campos de template"
  on public.template_campos for update
  using (is_master())
  with check (is_master());

create policy "Somente Master remove campos de template"
  on public.template_campos for delete
  using (is_master());

-- Mesmo raciocínio do GRANT de select acima: a policy de escrita só é
-- alcançada se o role authenticated tiver o privilégio de tabela
-- correspondente. is_master() dentro de cada policy continua sendo o que
-- de fato restringe a escrita a Master.
grant insert, update, delete on public.template_campos to authenticated;

-- ------------------------------------------------------------
-- 3. Seed — template de Fone de Ouvido
-- ------------------------------------------------------------
-- Garante a categoria "Fone de Ouvido" (idempotente via slug): em produção
-- ela já existe (criada pelo backfill da migração 023 a partir de produto
-- real) e este insert não faz nada; em uma branch de desenvolvimento nova,
-- o seed 002 não cria essa categoria (item 27 do BACKLOG.md — seed 002
-- incompatível com as categorias reais de produção), então o template
-- ficaria órfão sem esta linha.
insert into public.categorias (nome, slug)
values ('Fone de Ouvido', 'fone-de-ouvido')
on conflict (slug) do nothing;

-- Campo-chave tipo_conexao precisa existir (linha inserida) antes das
-- linhas que dependem dele, porque o trigger de validação roda por linha
-- na ordem em que a instrução VALUES é escrita abaixo.

insert into public.template_campos
  (categoria_id, chave, rotulo, grupo, tipo, unidade, opcoes, ordem, campo_dependencia, valores_dependencia)
select c.id, v.chave, v.rotulo, v.grupo, v.tipo, v.unidade, v.opcoes, v.ordem, v.campo_dependencia, v.valores_dependencia
from public.categorias c
cross join (
  values
    -- Sempre visível
    ('marca', 'Marca', 'Geral', 'texto', null::text, null::jsonb, 1, null::text, null::jsonb),
    ('modelo', 'Modelo', 'Geral', 'texto', null, null, 2, null, null),
    ('tipo_design', 'Tipo de design', 'Geral', 'selecao',
      null, '["intra-auricular", "supra-auricular", "circum-auricular"]'::jsonb, 3, null, null),
    ('driver_mm', 'Driver', 'Geral', 'numero', 'mm', null, 4, null, null),
    ('anc', 'Cancelamento de ruído ativo (ANC)', 'Geral', 'booleano', null, null, 5, null, null),
    ('resistencia_ip', 'Resistência à água/poeira', 'Geral', 'selecao',
      null, '["nenhuma", "ipx4", "ipx5", "ipx7", "ipx8"]'::jsonb, 6, null, null),
    ('microfone', 'Microfone embutido', 'Geral', 'booleano', null, null, 7, null, null),
    ('controles', 'Controles', 'Geral', 'selecao',
      null, '["toque", "fisico", "ambos", "nenhum"]'::jsonb, 8, null, null),
    ('autonomia_total_horas', 'Autonomia total', 'Autonomia e carga', 'numero', 'horas', null, 9, null, null),
    ('carga_rapida', 'Carga rápida', 'Autonomia e carga', 'booleano', null, null, 10, null, null),
    ('interface_carga', 'Interface de carga', 'Autonomia e carga', 'selecao',
      null, '["usb_c", "micro_usb", "usb_a", "lightning"]'::jsonb, 11, null, null),
    ('conteudo_caixa', 'Conteúdo da caixa', 'Geral', 'texto', null, null, 12, null, null),

    -- Campo-chave
    ('tipo_conexao', 'Tipo de conexão', 'Conexão', 'selecao',
      null, '["sem_fio", "com_fio"]'::jsonb, 13, null, null),

    -- Só quando sem_fio
    ('bluetooth_versao', 'Versão do Bluetooth', 'Sem fio', 'texto', null, null, 14,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('alcance_metros', 'Alcance', 'Sem fio', 'numero', 'm', null, 15,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('codecs', 'Codecs suportados', 'Sem fio', 'texto', null, null, 16,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('multiponto', 'Conexão multiponto', 'Sem fio', 'booleano', null, null, 17,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('bateria_fones_mah', 'Bateria dos fones', 'Sem fio', 'numero', 'mAh', null, 18,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('bateria_estojo_mah', 'Bateria do estojo', 'Sem fio', 'numero', 'mAh', null, 19,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('autonomia_fones_horas', 'Autonomia dos fones', 'Sem fio', 'numero', 'horas', null, 20,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('tempo_carga_horas', 'Tempo de carga', 'Sem fio', 'numero', 'horas', null, 21,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('carregamento_qi', 'Carregamento sem fio (Qi)', 'Sem fio', 'booleano', null, null, 22,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('assistente_voz', 'Assistente de voz', 'Sem fio', 'booleano', null, null, 23,
      'tipo_conexao', '["sem_fio"]'::jsonb),
    ('app_dedicado', 'App dedicado', 'Sem fio', 'booleano', null, null, 24,
      'tipo_conexao', '["sem_fio"]'::jsonb),

    -- Só quando com_fio
    ('impedancia_ohms', 'Impedância', 'Com fio', 'numero', 'ohms', null, 25,
      'tipo_conexao', '["com_fio"]'::jsonb),
    ('sensibilidade_db', 'Sensibilidade', 'Com fio', 'numero', 'dB', null, 26,
      'tipo_conexao', '["com_fio"]'::jsonb),
    ('resposta_frequencia', 'Resposta de frequência', 'Com fio', 'texto', null, null, 27,
      'tipo_conexao', '["com_fio"]'::jsonb),
    ('comprimento_cabo_m', 'Comprimento do cabo', 'Com fio', 'numero', 'm', null, 28,
      'tipo_conexao', '["com_fio"]'::jsonb),

    -- Último, sempre visível
    ('observacoes', 'Observações', 'Observações', 'texto', null, null, 29, null, null)
) as v(chave, rotulo, grupo, tipo, unidade, opcoes, ordem, campo_dependencia, valores_dependencia)
where c.slug = 'fone-de-ouvido';
