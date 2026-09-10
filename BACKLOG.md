# Backlog — SalvadoShop

Itens de melhoria de UX, UI e produto identificados durante testes.
Não bloqueiam o funcionamento do sistema (fluxo de compra e admin validados
em produção). Organizados por prioridade.

Legenda: [ ] pendente · [x] concluído

## 🔴 Prioridade alta — afeta a jornada de compra

- [x] **1. Página de produto não abre.** Não é possível clicar no card do
  produto para ver fotos e descrição — só o botão de compra funciona. A rota
  `/produto/[slug]` existe; investigar se o card apenas não está linkando.
  ✅ Resolvido em ee093f4
- [ ] **2. Botão "Comprar" ambíguo.** O botão diz "Comprar" mas adiciona ao
  carrinho. Definir o fluxo: renomear para "Adicionar ao carrinho" e/ou criar
  um "Comprar agora" que vá direto ao checkout.
- [x] **17. Botão "Chamar no WhatsApp" do rodapé envia mensagem de lote.**
  Na página inicial, sem nenhum produto selecionado, o botão do rodapé abre
  o WhatsApp com mensagem pré-carregada de um lote Tipo B específico ("Olá!
  Tenho interesse no lote: Lote 40 Smartphones Variados - Sinistro
  Transportadora, Quantidade: 40 unidades, Vi no site: salvadoshop.com.br").
  O rodapé é contato geral e deveria abrir mensagem neutra de negociação.
  Investigar se o componente do rodapé reaproveita o gerador de link do
  fluxo Tipo B, e se o lote citado vem de estado compartilhado ou de valor
  fixo no código. Verificar também se o mesmo botão aparece em outras
  páginas com o mesmo defeito.
  ✅ Não reproduzível — rascunho salvo no app do WhatsApp, não do código.
- [x] **18. Home não seleciona url_ml.** A query da home não seleciona
  `url_ml`, então produtos anunciados no ML aparecem na vitrine com a opção
  de compra no ML desabilitada. Na página do produto funciona normal. Bug
  pré-existente, anterior ao item 13.
  ✅ Resolvido — query e card da home passam a trazer `url_ml`
- [x] **20. Histórico de migrations do Supabase fora de sincronia com o
  repositório.** As migrations 003 a 022 existem em
  `src/lib/supabase/migrations` mas não estão registradas no histórico
  oficial do Supabase — foram aplicadas em produção via `apply_migration`
  sem passar pelo fluxo de migration versionada. Consequência: uma branch
  de desenvolvimento nova (`create_branch`) só replica o subconjunto de
  migrations que está de fato registrado no histórico, então nasce com
  schema incompleto (faltam colunas como `exclusivo_site` e `preco_venda`,
  entre outras) sem nenhum aviso de que algo está faltando. Descoberto
  durante o item 14: foi necessário reaplicar manualmente as migrations
  021 e 022 na branch de teste só para conseguir validar o fluxo de
  edição de produto. Investigar e ressincronizar o histórico de migrations
  do Supabase com o repositório.
  ✅ Resolvido — diagnóstico completo (arquivos não registrados,
  registros sem arquivo, nomes sem prefixo) e ressincronização: 7 arquivos
  já aplicados e nunca registrados (003, 005–010) inseridos diretamente em
  `supabase_migrations.schema_migrations` sem reexecutar SQL; 3 pedaços de
  schema aplicados em produção mas nunca commitados como arquivo
  (`status_produto.rascunho` + `produtos.url_ml`, colunas `pix_*` +
  `pedidos.numero_pedido`, `status_pedido.aguardando_cotacao_frete`)
  documentados retroativamente como 026, 027 e 028, com SQL recuperado
  literalmente do histórico do Supabase, marcados para nunca serem
  aplicados; 3 registros sem prefixo numérico (`rpc_pedido_estoque`,
  `pedidos_frete_e_dados_loja`, `trigger_ajustar_centavos_identificacao`)
  renomeados para `004_`, `019_` e `020_`. Backup do histórico anterior em
  [`docs/backup-supabase-migrations-20260910.json`](docs/backup-supabase-migrations-20260910.json).
  Validado criando uma branch de desenvolvimento do zero e comparando
  colunas, constraints, índices, triggers, funções e policies contra
  produção — schema idêntico, sem diferença. Ver item 25 para um bug
  real (não de registro) encontrado durante essa validação. Lição
  registrada no CLAUDE.md, seção 18.11.

## 🟡 Prioridade média — correção / validação

- [ ] **3. Validação de URL de rastreio no frontend.** O backend valida o
  formato (z.string().url()), mas o formulário permite enviar URL inválida e
  o usuário recebe erro genérico. Validar no input antes do envio, com
  mensagem clara. (Cenários: com URL válida → botão aparece; sem URL →
  esconder botão, usar só o código; formato inválido → bloquear no front.)
- [x] **4. Master cai na fila de aprovações.** Ao editar um produto como
  Master, a alteração vai para a fila de aprovações — mas o texto da tela diz
  "alterações enviadas pelos Auxiliares". Investigar se é intencional
  (auditoria de todas as edições) ou inconsistência (Master deveria publicar
  direto).
  ✅ Resolvido — a causa real não era o fluxo, e sim a tela de aprovações.
  `PUT /api/admin/produtos/[id]` já salva direto na tabela `produtos` para
  Master (sem passar pela fila) desde o commit `6d70aa4`, anterior à criação
  deste item; o fluxo do Auxiliar segue inalterado. O que induzia ao engano:
  a tela da fila tinha um cabeçalho fixo dizendo "alterações enviadas pelos
  Auxiliares" que aparecia mesmo com a lista vazia, e a aba "Pendentes" sem
  nenhum registro não deixava isso claro — ao editar como Master e ver a
  alteração já na vitrine, mas a fila com esse texto, dava a impressão de
  que a própria edição tinha caído ali. Corrigido nesta branch: cabeçalho
  reescrito para não sugerir que há algo pendente, e estado vazio explícito
  na aba "Pendentes" explicando que edições de Master são aplicadas direto.
- [x] **5. Imagens cortadas na vitrine.** Imagens em formato aceito no upload
  são exibidas com corte/"zoom" na loja. Provável object-fit: cover onde
  deveria ser contain, ou container com altura fixa que ignora a proporção.
  ✅ Resolvido na galeria (object-contain)
- [x] **19. Produto da triagem nasce em rascunho.** Produto vindo da triagem
  agora nasce sempre em rascunho e exige definição de canal (Mercado Livre ou
  exclusivo do site) e preço antes de publicar. Antes publicava direto na
  vitrine quando o usuário era Master — a triagem não coleta preço de venda
  nem URL do anúncio, então não tinha informação suficiente para decidir o
  canal (item 13) e podia publicar produto em estado inválido.
  ✅ Resolvido — `status` sempre nasce `rascunho` para Master (Auxiliar
  continua indo para a fila de aprovações, como sempre foi)
- [ ] **21. Remover a coluna `categoria` de produtos.** Desde o item 14,
  produto grava `categoria_id` (FK para a tabela `categorias`) e também
  o nome na coluna `categoria` antiga, para não quebrar as telas que
  ainda leem dela: vitrine (`VitrineCliente.tsx`, filtro por categoria),
  página de produto e página de lote. A tela de triagem
  (`TriagemClientUI.tsx` e `api/triagem/publicar/route.ts`) tem select
  próprio com valores fixos no código e também precisa passar a usar a
  tabela `categorias` antes da remoção. Fazer depois que o filtro por
  categoria na vitrine estiver pronto e ler de `categoria_id`.
- [ ] **24. Tela de triagem com preview de preço na fórmula antiga (18%
  fixo).** `TriagemClientUI.tsx` calcula um preview de "Preço no Site"
  como `preco_ml * 0.82` (com o texto "−18% automático") — regra removida
  no item do preço independente (`preco_site` deixou de ser `GENERATED`
  e passou a ser digitado pelo admin, não mais derivado de `preco_ml`).
  O preview nunca é gravado no banco (`api/triagem/publicar/route.ts` não
  aceita `preco_site` na escrita), mas mostra ao usuário um valor
  calculado por uma regra que não existe mais no sistema. Ajustar a tela
  para refletir a modelagem nova: os dois preços (site e ML) digitados
  separadamente, como no formulário de produto. Relacionado: a triagem
  também tem select de categoria com valores fixos no código, já
  apontado no item 21 e ainda pendente — os dois ajustes na tela de
  triagem podem ser feitos juntos.
- [x] **25. Seed de desenvolvimento (002) incompatível com a constraint da
  022.** Achado durante a validação do item 20 (branch de desenvolvimento
  criada do zero, sequência 001→025 replayada por completo): a migration
  002 insere produtos `tipo_a` cujo `url_ml` fica `NULL` (não preenchido
  no seed), e a 021 faz backfill de `exclusivo_site = (url_ml IS NULL OR
  url_ml = '')` — os 3 produtos do seed viram `exclusivo_site = true`.
  A 022 adiciona a constraint `chk_exclusividade_canal_publicado`
  exigindo `preco_venda NOT NULL` para todo `tipo_a` publicado e
  exclusivo — mas o seed nunca preencheu `preco_venda` para esses
  produtos, então a 022 quebra (`new row ... violates check constraint`)
  ao replayar a sequência completa numa branch nova, exigindo correção
  manual dos dados antes de continuar. Diferente do item 20 (que era só
  falta de registro no histórico), este é um bug real de conteúdo: a
  ordem 002→021→022 não é auto-consistente. Ajustar a 002 para preencher
  `url_ml` nos produtos não-exclusivos do seed (ou a 021/022 para tratar
  o caso), testando a sequência completa numa branch nova do zero antes
  de considerar resolvido.
  ✅ Resolvido — diagnóstico confirmou que só a 022 quebra por essa
  causa (023, 024 e 025 passam normalmente uma vez corrigidos os dados).
  A correção real exigiu dois ajustes na 002: (1) preencher `url_ml` nos
  3 produtos `tipo_a` individuais, fazendo-os nascer `exclusivo_site =
  false` — mesmo padrão dos produtos reais em produção hoje — e (2) criar
  a própria coluna `url_ml` antecipadamente via `ADD COLUMN IF NOT
  EXISTS` dentro da 002, já que essa coluna só existe a partir de uma
  migration posterior (`add_rascunho_status_and_url_ml`, 2026-06-26,
  um dia depois da 002) — sem isso a sequência quebrava na própria 002
  com "column url_ml does not exist", antes mesmo de chegar na 021/022.
  Migrations 021 a 025 não foram alteradas. Confirmado que nenhum
  produto deste seed existe em produção, então a mudança no arquivo não
  diverge do que rodou — o texto registrado da 002 em
  `supabase_migrations.schema_migrations` também foi atualizado (só
  metadado, sem reexecutar nada) para que branches futuras repliquem a
  versão corrigida automaticamente. Validado criando uma branch nova do
  zero: as 26 migrations (001→025) aplicaram sem nenhum erro e sem
  nenhuma intervenção manual; schema comparado contra produção
  (colunas, constraints, índices, triggers, funções, policies) —
  idêntico, sem diferença.
- [x] **22. Arraste para reordenar imagens nunca funcionava.** No bloco de
  imagens do formulário de produto (`ImageUploadZone.tsx`), o texto "Arraste
  as imagens para reordenar" aparecia mas o arraste não respondia — desde o
  commit `bb07679` (introdução do drag and drop), nunca funcionou de fato.
  Causa: a alça `GripVertical` era o único elemento com os listeners do
  `useSortable` (único ponto de ativação do arraste), mas ficava
  permanentemente invisível — `group-hover/card:opacity-100` mirava a
  classe `group/card`, que estava num elemento irmão posterior, não num
  ancestral comum, então a regra do Tailwind nunca ativava. O motor de
  drag (`@dnd-kit`) sempre funcionou; faltava um alvo alcançável.
  ✅ Resolvido — o card inteiro da miniatura passa a ser a área de arraste
  (listeners do `useSortable` no nó raiz). Editar e remover viram botões
  explícitos com hit-area própria (`stopPropagation` no `pointerdown`, para
  não competir com o gesto de arrastar); a alça `GripVertical` vira só
  indicação visual decorativa (`pointer-events-none`), sem ativar nada
  sozinha. `activationConstraint` do `PointerSensor`/`TouchSensor` mantido
  como já estava, agora exercido de fato. Adicionado `touch-action: none`
  (`touch-none`) no card, recomendação do dnd-kit para arraste em touch não
  competir com o scroll da página.

## 🟢 Prioridade baixa — polimento de UX/UI

- [ ] **6. Botão "Continuar" sob erro de estoque.** Quando há erro de estoque
  insuficiente no checkout, o botão verde "Continuar" continua visível,
  convidando a repetir uma ação que vai falhar. Desabilitar/esconder ou trocar
  por ação que resolve (ex.: "Voltar ao carrinho").
- [ ] **7. Checkout sem header/footer.** A tela de checkout não tem cabeçalho
  nem rodapé, faltando âncora de identidade (logo) e rota de fuga (voltar à
  loja). Manter enxuto para conversão, mas incluir logo clicável e um rodapé
  mínimo de segurança.
- [ ] **8. Densidade da informação no admin.** Informações muito espaçadas
  cansam em uso prolongado. Avaliar layout mais condensado/centralizado.
- [ ] **9. Fundo do admin cansativo.** Fundo branco com bordas quase
  transparentes cansa ao fim do dia. Avaliar cor de fundo suave e/ou tema
  claro/escuro.
- [ ] **10. Identidade visual dos emails.** Os emails já têm cabeçalho verde e
  nome da loja, mas de forma mínima. Adicionar logo (imagem), paleta exata da
  marca e possivelmente imagem do produto. Revisar junto com a configuração do
  domínio próprio (ação 37).
- [x] **11. Tracking visual de status.** Barra de progresso visual do pedido
  (Criado → Despachado → Em trânsito → Saiu para entrega → Entregue), usando o
  status que já existe. Aplicável no detalhe do pedido (admin) e numa página
  de acompanhamento para o cliente.
  ✅ Resolvido (barra no detalhe do admin)
- [ ] **23. Reordenar imagens de produto não funciona por teclado.** O
  `@dnd-kit` do bloco de imagens (`ImageUploadZone.tsx`) está sem
  `KeyboardSensor` configurado — a reordenação só é possível com mouse ou
  toque. Achado durante a correção do item 22; nunca funcionou por teclado,
  não é regressão. Corrigir junto de uma revisão de acessibilidade do
  admin.

## 🔵 Funcionalidades novas — priorizadas (P0–P3)

- [ ] **12. [P0] Clonagem de produto.** Como administrador, quero duplicar um
  produto existente para agilizar cadastro de variações. Ícone de duplicar na
  tabela de listagem de produtos do admin. Server Action que lê o produto por
  id, copia os campos e insere novo registro. Regras obrigatórias na cópia:
  não copiar id, slug, sku, url do Mercado Livre; título recebe sufixo
  " (Cópia)"; slug gerado a partir do novo título; estoque zerado; status
  inicial rascunho, nunca publicado; clone nasce sem linhas em
  `produto_imagens` — admin reenvia as fotos manualmente na tela de edição
  (motivo: `produto_imagens.public_id` tem UNIQUE global e as rotas de
  exclusão de imagem apagam do Cloudinary sem checar se outro produto ainda
  referencia o mesmo arquivo). Como a `ml_url` não é copiada, o clone
  deve nascer com `exclusivo_site = true` (ver item 13) — caso contrário fica
  em estado inválido: não exclusivo e sem link. Após insert, redirect para a
  tela de edição do novo produto.
- [ ] **13. [P1] Exclusividade de canal.** Como administrador, quero marcar se
  o produto é exclusivo do site ou se tem anúncio no Mercado Livre.
  **Modelagem:** coluna `exclusivo_site` boolean not null default false em
  `produtos`, via `apply_migration`. Não criar tabela de canais nem coluna
  array — são apenas dois estados e o site está sempre ativo. Backfill na
  própria migration: `true` onde `ml_url` é nula ou vazia, `false` onde
  preenchida.
  **UI no editor de produto:** radio no painel lateral com duas opções,
  "Exclusivo do site" e "Anunciado no Mercado Livre". Ao marcar Exclusivo do
  site, o campo de URL do ML fica desabilitado e o valor é apagado no save. Ao
  marcar Anunciado no ML, a URL do ML vira campo obrigatório para publicar.
  **Validação no save:** bloquear publicação de produto não exclusivo sem
  `ml_url`; produto exclusivo salvo com `ml_url` não nula é estado inválido —
  apagar antes do insert.
  **Vitrine:** `exclusivo_site = true` → preço único, sem preço riscado, sem
  badge de 18%, etiqueta "Exclusivo". `exclusivo_site = false` → comportamento
  atual do Tipo A, comparativo de 18% contra o preço do ML. Fluxo Tipo B
  inalterado, continua indo para WhatsApp.
  **Verificação:** produto exclusivo publicado não renderiza badge de
  desconto; produto com ML mantém o comparativo idêntico ao atual; tentativa
  de publicar produto não exclusivo sem `ml_url` é bloqueada.
- [ ] **14. [P1] Criação dinâmica de categorias.** Como administrador, quero
  criar categoria sem sair da tela de cadastro do produto. Não usar
  react-select — usar combobox headless com input filtrável, estilizado com
  Tailwind, consistente com o restante do admin. Quando o termo digitado não
  existir, exibir opção "Criar categoria: [termo]". Ao confirmar: normalizar
  slug, checar duplicidade case-insensitive e sem acentos antes do insert,
  inserir via Server Action, atualizar lista local e já deixar selecionada. Se
  a checagem encontrar categoria equivalente, selecionar a existente em vez de
  criar nova. Restringir criação ao papel Master.
- [ ] **15. [P2] Preenchimento por Vision AI.** Como administrador, quero
  extrair título, marca e especificações da foto da embalagem. NÃO disparar
  automaticamente no upload — botão explícito "Preencher com IA" ao lado do
  bloco de imagens. Chamada obrigatoriamente via route handler server-side;
  chave de API nunca no client. Prompt deve forçar retorno JSON com chaves
  `nome_produto`, `marca`, `especificacoes_tecnicas`. Nunca sobrescrever campo
  já preenchido pelo admin — preencher apenas vazios e destacar visualmente os
  campos preenchidos por IA para revisão. Tratar falha de parse e resposta
  vazia sem quebrar o formulário. Registrar log de uso para acompanhar custo.
- [ ] **16. [P3] Analytics de produto.** Como administrador, quero ver
  visualizações e acessos por produto. Não fazer update em `produtos` a cada
  evento — criar tabela `produto_eventos` append-only com `produto_id`, `tipo`
  (impressão ou acesso), `sessao`, `created_at` (migration via
  `apply_migration`). Insert fire-and-forget: falha de tracking nunca bloqueia
  o render da vitrine. Deduplicar por sessão para não inflar com bot e reload.
  Rollup agendado para tabela de agregados — o painel lê do agregado e nunca
  da tabela bruta. Badge ou sparkline no painel do admin. Avaliar antes de
  implementar se o Vercel Analytics já cobre a necessidade a custo zero de
  manutenção.

---
*Criado em: 2026-07-25 · Fonte: testes do sistema em produção*
*Atualizado em: 2026-09-10 (item 24)*