# Backlog — SalvadoShop

Itens de melhoria de UX, UI e produto identificados durante testes.
Não bloqueiam o funcionamento do sistema (fluxo de compra e admin validados
em produção). Organizados por prioridade.

Legenda: [ ] pendente · [x] concluído

## 🔴 Prioridade alta — afeta a jornada de compra

- [ ] **1. Página de produto não abre.** Não é possível clicar no card do
  produto para ver fotos e descrição — só o botão de compra funciona. A rota
  `/produto/[slug]` existe; investigar se o card apenas não está linkando.
- [ ] **2. Botão "Comprar" ambíguo.** O botão diz "Comprar" mas adiciona ao
  carrinho. Definir o fluxo: renomear para "Adicionar ao carrinho" e/ou criar
  um "Comprar agora" que vá direto ao checkout.

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
- [ ] **5. Imagens cortadas na vitrine.** Imagens em formato aceito no upload
  são exibidas com corte/"zoom" na loja. Provável object-fit: cover onde
  deveria ser contain, ou container com altura fixa que ignora a proporção.

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
- [ ] **11. Tracking visual de status.** Barra de progresso visual do pedido
  (Criado → Despachado → Em trânsito → Saiu para entrega → Entregue), usando o
  status que já existe. Aplicável no detalhe do pedido (admin) e numa página
  de acompanhamento para o cliente.

---
*Criado em: 2026-07-25 · Fonte: testes do sistema em produção*
