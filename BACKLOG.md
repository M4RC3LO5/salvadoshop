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

## 🟡 Prioridade média — correção / validação

- [ ] **3. Validação de URL de rastreio no frontend.** O backend valida o
  formato (z.string().url()), mas o formulário permite enviar URL inválida e
  o usuário recebe erro genérico. Validar no input antes do envio, com
  mensagem clara. (Cenários: com URL válida → botão aparece; sem URL →
  esconder botão, usar só o código; formato inválido → bloquear no front.)
- [ ] **4. Master cai na fila de aprovações.** Ao editar um produto como
  Master, a alteração vai para a fila de aprovações — mas o texto da tela diz
  "alterações enviadas pelos Auxiliares". Investigar se é intencional
  (auditoria de todas as edições) ou inconsistência (Master deveria publicar
  direto).
- [x] **5. Imagens cortadas na vitrine.** Imagens em formato aceito no upload
  são exibidas com corte/"zoom" na loja. Provável object-fit: cover onde
  deveria ser contain, ou container com altura fixa que ignora a proporção.
  ✅ Resolvido na galeria (object-contain)

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
*Atualizado em: 2026-09-08*