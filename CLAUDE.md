# CLAUDE.md — SalvadoShop

> Este arquivo é a fonte de verdade do projeto para o Claude Code.
> Leia este arquivo completamente antes de qualquer ação no projeto.
> Em caso de dúvida sobre qualquer decisão, consulte este documento.

---

## 1. O QUE É O SALVADOSHOP

E-commerce familiar brasileiro especializado em **produtos salvados** — itens adquiridos de transportadoras, seguradoras e lotes leiloados da Receita Federal, comercializados por uma empresa familiar com mais de 20 anos de mercado.

**Site:** salvadoshop.vercel.app (produção futura: salvadoshop.com.br)
**Repositório:** github.com/M4RC3LO5/salvadoshop
**Dono do projeto:** Marcelo (m4rc3lo5@gmail.com)

---

## 2. STACK TECNOLÓGICA

```
Frontend:    Next.js 14 (App Router)
Estilo:      Tailwind CSS + shadcn/ui
Banco:       Supabase (PostgreSQL)
Auth:        Supabase Auth
Imagens:     Cloudinary
Deploy:      Vercel (auto-deploy a cada push na main)
Pagamentos:  Stripe (cartão) + Pix via Mercado Pago
Email:       Resend
Erros:       Sentry
```

**Versões mínimas:**
- Node.js 18+
- Next.js 14.x com App Router (NUNCA Pages Router)
- TypeScript strict mode SEMPRE ativo

---

## 3. REGRAS DE NEGÓCIO — LEIA COM ATENÇÃO

### 3.1 Dois tipos de produto

**TIPO A — Produto Individual (ML ou Site)**
- O cliente escolhe onde comprar via popup de comparação
- **Opção ML:** redireciona para a loja oficial no Mercado Livre com aviso de segurança
- **Opção Site:** desconto automático de 18% (o que a plataforma cobrava)
- O desconto de 18% é calculado SEMPRE automaticamente — nunca manualmente
- Fórmula: `precoSite = precoML * 0.82`

**TIPO B — Lote para Revendedores**
- Quantidade fixa definida pelo vendedor (não alterável pelo cliente)
- Sem preço fixo — negociação via WhatsApp
- Botão "Vamos Negociar?" abre WhatsApp com mensagem pré-formatada
- Público-alvo: lojas, investidores, revendedores

### 3.2 Sistema de usuários Admin

**MASTER:**
- Publica produtos diretamente sem aprovação
- Aprova ou rejeita alterações de Auxiliares com motivo obrigatório
- Gerencia usuários (criar, editar, remover Auxiliares)
- Acessa todos os relatórios
- Vê fila de aprovações pendentes

**AUXILIAR:**
- Cadastra e edita produtos
- Todas as alterações ficam com status PENDENTE até aprovação do Master
- NÃO acessa a fila de aprovações
- NÃO gerencia outros usuários
- NÃO publica diretamente — sempre via aprovação

### 3.3 Fluxo de compra Tipo A

```
Cliente clica "Comprar"
→ Popup abre com comparação de preços
→ Cliente escolhe: ML ou Site
  → ML: aviso de segurança → redireciona para ML
  → Site: fluxo de checkout interno (Pix ou Cartão)
```

### 3.4 Fluxo de compra Tipo B

```
Cliente clica "Vamos Negociar?"
→ Abre WhatsApp com mensagem pré-formatada incluindo nome do lote
→ Negociação humana fora do sistema
```

---

## 4. ARQUITETURA DE PASTAS

```
salvadoshop/
├── app/                          # App Router do Next.js
│   ├── (public)/                 # Rotas públicas
│   │   ├── page.tsx              # Home / Vitrine
│   │   ├── produto/[slug]/       # Página de produto
│   │   ├── lotes/                # Listagem de lotes
│   │   ├── carrinho/             # Carrinho
│   │   ├── checkout/             # Checkout
│   │   └── conta/                # Login / Registro cliente
│   ├── (admin)/                  # Rotas administrativas — PROTEGIDAS
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── produtos/
│   │   │   ├── aprovacoes/       # SOMENTE MASTER
│   │   │   ├── usuarios/         # SOMENTE MASTER
│   │   │   └── relatorios/       # SOMENTE MASTER
│   └── api/                      # API Routes
│       ├── produtos/
│       ├── checkout/
│       ├── webhook/              # Stripe e Mercado Pago webhooks
│       └── admin/
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── produto/                  # Componentes de produto
│   ├── admin/                    # Componentes do painel admin
│   └── shared/                   # Componentes reutilizáveis
├── lib/
│   ├── supabase/                 # Cliente e helpers do Supabase
│   ├── cloudinary/               # Upload e transformações
│   ├── stripe/                   # Integração Stripe
│   ├── validations/              # Schemas Zod
│   └── utils/                   # Funções utilitárias
├── middleware.ts                 # Proteção de rotas admin — CRÍTICO
├── .env.local                    # NUNCA commitar — está no .gitignore
└── CLAUDE.md                     # Este arquivo
```

---

## 5. SEGURANÇA — REGRAS INVIOLÁVEIS

### 5.1 OWASP Top 10 — Aplicação obrigatória

| Risco | Como mitigar neste projeto |
|---|---|
| Injeção SQL | Sempre usar Supabase client com queries parametrizadas. NUNCA concatenar strings SQL |
| Autenticação fraca | Supabase Auth para tudo. Sem autenticação própria |
| Exposição de dados | Variáveis sensíveis APENAS em .env.local ou Vercel env vars |
| XML/XXE | Não aplicável — usamos JSON |
| Controle de acesso quebrado | Middleware em TODAS as rotas /admin/* |
| Configuração incorreta | Headers de segurança no next.config.js |
| XSS | Next.js escapa por padrão — nunca usar dangerouslySetInnerHTML |
| Deserialização insegura | Validar TODOS os inputs com Zod antes de processar |
| Componentes vulneráveis | npm audit a cada sprint |
| Logging insuficiente | Sentry + logs estruturados em todas as rotas de API |

### 5.2 Headers HTTP obrigatórios — next.config.js

```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
```

### 5.3 PCI-DSS Awareness

- **NUNCA** criar campos HTML que capturem número de cartão, CVV ou dados bancários
- Pagamentos via cartão SEMPRE pelo Stripe Checkout (hosted) ou Stripe Elements
- Dados de cartão NUNCA passam pelo servidor do SalvadoShop
- Webhooks do Stripe SEMPRE validados com `stripe.webhooks.constructEvent()`

### 5.4 Rate Limiting

Aplicar rate limiting em TODAS as rotas de API públicas:
- Login: máximo 5 tentativas por IP por 15 minutos
- Checkout: máximo 10 requisições por IP por hora
- Upload de imagens: máximo 20 por usuário por hora
- Usar `@upstash/ratelimit` com Redis ou Vercel KV

### 5.5 Proteção de rotas — middleware.ts

```typescript
// Regra: TODA rota /admin/* exige autenticação E role adequada
// Master: acessa tudo em /admin/*
// Auxiliar: acessa /admin/* EXCETO /admin/aprovacoes, /admin/usuarios, /admin/relatorios
// Cliente: NUNCA acessa /admin/*
// Não autenticado: redireciona para /conta/login
```

### 5.6 Validação de inputs

- **Zod** para validar TODOS os dados de entrada em API routes
- Validar no servidor SEMPRE — validação no cliente é apenas UX, não segurança
- Sanitizar nomes de arquivo no upload de imagens
- Tamanho máximo de upload: 10MB por imagem

---

## 6. LGPD E CONFORMIDADE LEGAL

### 6.1 LGPD — Lei 13.709/2018

**Dados coletados e base legal:**
| Dado | Finalidade | Base Legal |
|---|---|---|
| Nome e email | Cadastro e comunicação | Contrato |
| CPF | Emissão de nota fiscal | Obrigação legal |
| Endereço | Entrega do produto | Contrato |
| IP e logs de acesso | Segurança e Marco Civil | Obrigação legal |
| Preferências de navegação | Melhoria da experiência | Legítimo interesse |

**Implementações obrigatórias:**
- Banner de cookies com aceite explícito antes de qualquer rastreamento
- Página `/privacidade` com política completa em linguagem simples
- Página `/termos` com termos de uso
- Funcionalidade de exclusão de conta (direito ao esquecimento)
- Funcionalidade de exportação de dados pessoais
- Logs de consentimento armazenados no Supabase

### 6.2 Marco Civil da Internet — Lei 12.965/2014

- Logs de acesso armazenados por **mínimo 6 meses** (obrigatório por lei)
- Tabela `access_logs` no Supabase com: IP, timestamp, rota acessada, user_id
- Logs de ações administrativas (quem fez o quê e quando)

### 6.3 Código de Defesa do Consumidor — CDC

- Prazo de arrependimento de **7 dias** para compras online — implementar fluxo de cancelamento
- CNPJ, razão social e endereço visíveis no footer e página `/sobre`
- Política de troca e devolução visível ANTES da finalização da compra
- Preço total (com frete) exibido ANTES do pagamento

### 6.4 Acessibilidade — WCAG 2.1 nível AA

- Todos os componentes com `aria-label` adequado
- Contraste mínimo de 4.5:1 para texto normal
- Navegação completa por teclado (Tab, Enter, Esc)
- Imagens com `alt` descritivo SEMPRE
- Formulários com labels associados (`htmlFor`)
- Mensagens de erro anunciadas para leitores de tela

---

## 7. BANCO DE DADOS — SUPABASE

### 7.1 Tabelas principais

```sql
-- Produtos
produtos (id, nome, slug, descricao, specs_tecnicas, tipo, preco_ml, 
          preco_site, status, categoria, sinistro, estoque, criado_por, 
          aprovado_por, created_at, updated_at)

-- Imagens dos produtos
produto_imagens (id, produto_id, url_cloudinary, public_id, ordem, created_at)

-- Usuários admin
admin_usuarios (id, user_id, role, nome, email, ativo, created_at)

-- Fila de aprovações
aprovacoes (id, produto_id, admin_id, tipo_alteracao, dados_anteriores, 
            dados_novos, status, motivo_rejeicao, created_at, resolved_at)

-- Pedidos
pedidos (id, cliente_id, status, total, forma_pagamento, stripe_payment_id,
         endereco_entrega, created_at, updated_at)

-- Itens do pedido
pedido_itens (id, pedido_id, produto_id, preco_unitario, quantidade)

-- Logs de acesso (Marco Civil)
access_logs (id, user_id, ip, rota, metodo, created_at)

-- Logs de consentimento (LGPD)
consentimentos (id, user_id, tipo, aceito, ip, created_at)
```

### 7.2 Row Level Security (RLS)

- RLS **SEMPRE ativo** em todas as tabelas
- Clientes só veem seus próprios pedidos
- Auxiliares só veem produtos e suas próprias aprovações
- Masters veem tudo na área admin
- Tabela `access_logs` — somente inserção para usuários autenticados, leitura somente para Masters

---

## 8. IMAGENS — CLOUDINARY

```
Cloud Name: dtuclb3q1
Variável:   CLOUDINARY_URL no .env.local
```

**Regras:**
- Formatos aceitos: JPG, PNG, WEBP
- Tamanho máximo: 10MB por imagem
- Máximo de imagens por produto: 10
- Transformações automáticas: resize para 800x800 max, qualidade 85%
- Pasta no Cloudinary: `salvadoshop/produtos/{produto_id}/`
- Sempre salvar o `public_id` do Cloudinary no banco para permitir exclusão

---

## 9. PERFORMANCE — METAS OBRIGATÓRIAS

### Core Web Vitals (metas de produção)
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **Lighthouse Score**: > 90 em todas as categorias

### Estratégia de cache

```
Páginas estáticas:     Home, Sobre, Privacidade → ISR com revalidação a cada 60s
Página de produto:     SSR com cache de 30s (preço pode mudar)
Painel admin:          Sem cache — sempre dados frescos
Imagens Cloudinary:    Cache via CDN do Cloudinary (automático)
```

### Otimizações obrigatórias
- Sempre usar `next/image` para imagens — NUNCA `<img>` direto
- Lazy loading em imagens fora do viewport
- Fonts via `next/font` — NUNCA importar do Google Fonts diretamente
- Componentes grandes com `dynamic()` e `loading: 'lazy'`

---

## 10. TRATAMENTO DE ERROS

### Padrão de resposta de API

```typescript
// Sucesso
{ success: true, data: T }

// Erro
{ success: false, error: { code: string, message: string, details?: unknown } }
```

### Códigos de erro padronizados

```
AUTH_REQUIRED        Usuário não autenticado
FORBIDDEN            Sem permissão para esta ação
NOT_FOUND            Recurso não encontrado
VALIDATION_ERROR     Dados inválidos (incluir detalhes do Zod)
PAYMENT_FAILED       Falha no pagamento
UPLOAD_FAILED        Falha no upload de imagem
INTERNAL_ERROR       Erro interno (logar no Sentry)
```

### Regra: NUNCA expor erros internos ao cliente
- Erros do Supabase, Stripe, Cloudinary → logar no Sentry, retornar mensagem genérica
- Stack traces NUNCA aparecem no response da API em produção

---

## 11. OBSERVABILIDADE

### Sentry
- Integrado em `app/layout.tsx` e `middleware.ts`
- Capturar TODOS os erros não tratados
- Adicionar contexto de usuário quando autenticado
- Alertas para erros em rotas de pagamento

### Logging estruturado

```typescript
// Padrão de log para ações importantes
console.log(JSON.stringify({
  event: 'produto.publicado',
  produto_id: string,
  admin_id: string,
  role: 'master' | 'auxiliar',
  timestamp: new Date().toISOString()
}))
```

### Analytics (implementar na Fase 4)
- Vercel Analytics para Web Vitals
- Evento de clique: ML vs Site (para otimizar conversão)
- Funil de checkout (onde os clientes abandonam)

---

## 12. POLÍTICA DE BRANCHES E COMMITS

### Branches

```
main          → produção (Vercel deploy automático) — NUNCA commitar direto
develop       → integração (base para feature branches)
feature/xxx   → nova funcionalidade
fix/xxx       → correção de bug
```

### Regras
- **NUNCA** commitar diretamente na `main`
- **NUNCA** commitar `.env.local` ou qualquer arquivo com credenciais
- Pull Request obrigatório para merge na `main`
- Mensagens de commit em português e descritivas

### Padrão de commit

```
feat: adiciona componente CardProdutoTipoA
fix: corrige calculo de desconto 18% no checkout
docs: atualiza CLAUDE.md com regras de imagem
style: ajusta cores do header mobile
refactor: extrai logica de aprovacao para hook
```

---

## 13. VARIÁVEIS DE AMBIENTE

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # NUNCA expor no frontend

# Cloudinary
CLOUDINARY_URL=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dtuclb3q1

# Stripe
STRIPE_SECRET_KEY=               # NUNCA expor no frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Mercado Pago (Pix)
MERCADOPAGO_ACCESS_TOKEN=        # NUNCA expor no frontend

# WhatsApp
NEXT_PUBLIC_WHATSAPP_NUMBER=     # Número com DDI: 5511999999999

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Resend (email)
RESEND_API_KEY=
```

**Regra crítica:** Variáveis sem `NEXT_PUBLIC_` são server-only. NUNCA usar variável server-only em componentes client (`'use client'`).

---

## 14. CHECKLIST ANTES DE CADA COMMIT

- [ ] Nenhuma credencial ou chave de API no código
- [ ] Inputs validados com Zod na API route
- [ ] Rota admin protegida pelo middleware
- [ ] Sem `console.log` de dados sensíveis
- [ ] Imagens usando `next/image`
- [ ] Erros logados no Sentry, mensagem genérica para o cliente
- [ ] RLS do Supabase não foi desabilitado
- [ ] Sem `dangerouslySetInnerHTML`
- [ ] TypeScript sem erros (`npm run type-check`)

---

## 15. CONTEXTO ADICIONAL

- O sogro do Marcelo é o dono da loja — linguagem do sistema deve ser simples e familiar
- O painel admin será usado por funcionários sem perfil técnico
- Produtos salvados têm história — a descrição comercial é fundamental para a venda
- O botão "Melhorar com IA" usa a API da Anthropic (claude-sonnet-4-6) para gerar descrições
- Prioridade de desenvolvimento: funcionalidade > perfeição visual (o Tailwind já garante qualidade base)
- Em caso de dúvida entre duas abordagens, escolha a mais simples e segura

---

## 16. PAGAMENTOS — DECISÕES ARQUITETURAIS

### 16.1 Stripe (Cartão)

- Conta gratuita — cobrança apenas por transação (3,99% + R$ 0,39 nacional)
- **NUNCA** armazenar dados de cartão — sempre via Stripe Checkout hosted ou Stripe Elements
- Webhooks validados com `stripe.webhooks.constructEvent()` SEMPRE
- Em desenvolvimento: usar Stripe CLI para receber webhooks localmente (`stripe listen --forward-to localhost:3000/api/webhook/stripe`)
- Stripe **não suporta Pix no Brasil** — usar Mercado Pago para Pix

### 16.2 Mercado Pago (Pix)

- Usado exclusivamente para pagamentos via Pix
- Conta atual: conta pessoal do Marcelo (m4rc3lo5@gmail.com) — uso temporário durante desenvolvimento
- Webhooks do MP validados com header `x-signature` SEMPRE
- Polling de status a cada 5 segundos enquanto aguarda confirmação do Pix

### 16.3 Modelo Multi-vendedor (Fase Futura)

O sistema foi projetado para suportar múltiplos vendedores no futuro (ex: produtos do Marcelo + produtos do sogro com contas MP e Stripe separadas).

**Arquitetura preparada — tabela `configuracoes_loja`:**

```sql
configuracoes_loja (
  id            UUID PRIMARY KEY,
  nome_loja     TEXT NOT NULL,
  whatsapp      TEXT,
  mp_access_token    TEXT,  -- token MP do vendedor (server-only, nunca expor)
  stripe_account_id  TEXT,  -- conta Stripe do vendedor
  ml_url_loja        TEXT,  -- URL da loja no Mercado Livre
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
)
```

Cada produto terá um campo `loja_id` associado. Por enquanto todos os produtos usam a configuração padrão (loja única). A UI de seleção de loja por produto será implementada na Fase 4.

**Regra crítica:** `mp_access_token` e `stripe_account_id` são SEMPRE server-only — NUNCA expor no frontend.

### 16.4 Fluxo de pagamento Pix

```
Cliente escolhe Pix no checkout
→ API Route cria cobrança no Mercado Pago
→ Exibe QR Code + código copia-e-cola
→ Polling a cada 5s verifica status
→ Webhook MP confirma pagamento
→ Cria pedido no banco
→ Atualiza estoque (decrementa quantidade)
→ Envia email de confirmação (Resend)
→ Redireciona para /checkout/sucesso
```

### 16.5 Fluxo de pagamento Cartão

```
Cliente escolhe Cartão no checkout
→ API Route cria Stripe Checkout Session
→ Redireciona para página hosted do Stripe
→ Cliente paga no ambiente seguro do Stripe
→ Stripe redireciona para /checkout/sucesso ou /checkout/falha
→ Webhook Stripe confirma pagamento
→ Cria pedido no banco
→ Atualiza estoque
→ Envia email de confirmação (Resend)
```

---

## 17. VARIÁVEIS DE AMBIENTE — FASE 3 (PAGAMENTOS)

Adicionar ao `.env.local` e configurar no Vercel:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...          # NUNCA expor no frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   # NUNCA expor no frontend

# URLs de retorno (Stripe e MP precisam de URLs absolutas)
NEXT_PUBLIC_APP_URL=https://salvadoshop.com.br  # produção
# Em dev: http://localhost:3000
```

**Em desenvolvimento:** usar chaves de teste do Stripe (`sk_test_...` e `pk_test_...`) e sandbox do Mercado Pago.

---

## 18. DECISÕES PENDENTES

### 18.1 RESOLVIDA — Quando o pedido é criado no Supabase (Bloco 6, item 29)

**Decisão:** o pedido (`pedidos` + `pedido_itens`) é criado no Supabase **antes** do checkout — ao clicar em "Continuar" na página `/checkout`, dentro da rota `POST /api/checkout/stripe` — e não dentro do webhook. O webhook (`/api/webhook/stripe`) apenas **atualiza** o status do pedido existente para `pago` ao receber `checkout.session.completed`; ele nunca cria um pedido novo.

A baixa de estoque acontece no mesmo momento (antes do checkout), de forma atômica, via a função `criar_pedido_com_estoque` (`src/lib/supabase/migrations/004_rpc_pedido_estoque.sql`). Se o estoque for insuficiente para qualquer item, a função lança exceção, a transação inteira é revertida (nenhum pedido é criado, nenhum estoque é decrementado) e o cliente recebe o erro **antes** de pagar. O preço unitário também é lido de `produtos.preco_site` dentro da função — nunca aceito do cliente — para impedir manipulação de preço.

**Estorno implementado (ver 18.4):** a reversão de estoque quando a sessão do Stripe expira sem conclusão foi implementada. O parágrafo original desta nota (que marcava isso como pendência) foi resolvido no fechamento do Bloco 6.

### 18.2 ABERTA — Identidade do cliente no checkout sem conta (guest checkout)

A tabela `pedidos.cliente_id` é `UUID NOT NULL` com FK para `auth.users.id`, e a RLS de INSERT exige `cliente_id = auth.uid()`. Como o cadastro/login de cliente (`app/(public)/conta/`) ainda não foi implementado, a rota `POST /api/checkout/stripe` usa **Supabase Anonymous Sign-in** (`supabase.auth.signInAnonymously()`) para garantir uma sessão válida antes de criar o pedido — o comprador convidado vira um usuário anônimo real do Supabase Auth, que pode futuramente ser convertido em conta completa sem perder o histórico de pedidos.

**Ação necessária, fora do código:** habilitar "Allow anonymous sign-ins" no Supabase Dashboard → Authentication → Sign In / Providers do projeto `salvadoshop`. Sem isso, `signInAnonymously()` falha com `"Anonymous sign-ins are disabled"` e o checkout com cartão retorna `AUTH_REQUIRED`. Confirmado em teste local nesta sessão — a lógica de pedido/estoque foi validada diretamente contra o banco (RPC chamada com um `cliente_id` real), mas o fluxo HTTP completo via `/api/checkout/stripe` só funciona de ponta a ponta depois que essa opção for ativada.

### 18.3 RESOLVIDA — Correções pós-revisão de diff (Bloco 6)

Três correções aplicadas após revisão do diff completo do bloco, todas
commitadas em `feature/bloco6-item26-stripe-checkout-session`:

1. **Autorização na RPC `criar_pedido_com_estoque`.** A função é
   `SECURITY DEFINER` e contornava a RLS de INSERT em `pedidos`, permitindo
   que qualquer usuário autenticado (inclusive sessão anônima) criasse pedido
   e debitasse estoque em nome de outro `cliente_id` via chamada direta da
   RPC. Corrigido validando `p_cliente_id` contra `auth.uid()`
   (`migrations/005_fix_rpc_autorizacao_cliente.sql`), com hardening para
   barrar também chamadas sem sessão — `auth.uid() IS NULL`
   (`migrations/006_hardening_rpc_auth_null.sql`). Ambas aplicadas em produção
   e verificadas diretamente no banco (retorno `UNAUTHORIZED` confirmado).

2. **`orderId` estável no checkout.** Antes gerado a cada clique em
   "Continuar", o que permitia pedido duplicado / duplo débito de estoque em
   retry. Agora gerado uma vez por montagem da página (`src/app/checkout/page.tsx`)
   e reutilizado nas tentativas. Paliativo — a reversão completa de estoque
   continua pendente (ver 18.1).

3. **Opção Pix ocultada.** Não funcional neste bloco; Cartão de Crédito passa
   a ser a única forma de pagamento, pré-selecionada. Toggle removido de
   `src/app/checkout/page.tsx`.

### 18.4 RESOLVIDA — Estorno de estoque para pedidos não pagos (Bloco 6)

Fecha a pendência que estava aberta na 18.1. Quando um pedido é criado (estoque
debitado) mas o pagamento não se conclui, o estoque é devolvido e o pedido
cancelado, via a abordagem de expiração da Checkout Session:

- **Expiração curta:** a Checkout Session é criada com `expires_at` de 30 min
  (mínimo do Stripe) em `src/app/api/checkout/stripe/route.ts`, reduzindo o
  tempo que o estoque fica retido.
- **RPC de estorno:** `estornar_pedido_estoque(p_pedido_id)`
  (`migrations/007_rpc_estornar_estoque.sql`) cancela o pedido e devolve o
  estoque de cada item, mas **somente** se o pedido ainda estiver em
  `aguardando_pagamento` (UPDATE condicional). Isso garante idempotência
  (reentrega do evento não estorna duas vezes) e evita corrida com pagamento
  tardio (não estorna pedido já `pago`). Status final do pedido estornado:
  `cancelado`. Sem GRANT — chamada só pelo webhook via service role. Testada
  diretamente no banco (estorno, idempotência e não-mexer-em-pago verificados).
- **Webhook:** `checkout.session.expired` em
  `src/app/api/webhook/stripe/route.ts` extrai o `orderId` do metadata e chama
  a RPC.

**Pendência de configuração (fora do código):** o evento
`checkout.session.expired` precisa ser habilitado no endpoint de webhook do
Stripe (Developers → Webhooks), em ambientes de teste e produção. Sem isso o
Stripe não entrega o evento e o estorno não dispara. Recomenda-se validar
ponta a ponta com `stripe trigger checkout.session.expired` (Stripe CLI).

---

*Última atualização: Julho 2026*
*Versão: 2.3*
