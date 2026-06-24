# SalvadoShop
E-commerce familiar especializado em produtos salvados — itens adquiridos de transportadoras, seguradoras e lotes leiloados da Receita Federal.
> **Repositório privado.** Para dúvidas, fale com Marcelo (m4rc3lo5@gmail.com).
---
## Índice
1. [Sobre o projeto](#sobre-o-projeto)
2. [Como rodar localmente](#como-rodar-localmente)
3. [Estrutura do sistema](#estrutura-do-sistema)
4. [Regras de negócio](#regras-de-negócio)
5. [Painel administrativo](#painel-administrativo)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Deploy](#deploy)
8. [Stack tecnológica](#stack-tecnológica)
9. [Contato e suporte](#contato-e-suporte)
---
## Sobre o projeto
O SalvadoShop é o e-commerce da família, construído para vender dois tipos de produto:
- **Produtos individuais** — o cliente escolhe comprar pelo Mercado Livre (mais segurança) ou pelo site (18% mais barato)
- **Lotes para revendedores** — quantidade fixa, negociação via WhatsApp
O sistema tem uma área administrativa completa onde funcionários cadastram produtos, fazem upload e edição de fotos, e usam IA para melhorar as descrições comerciais.
**Links:**
- Produção: [salvadoshop.vercel.app](https://salvadoshop.vercel.app)
- Repositório: [github.com/M4RC3LO5/salvadoshop](https://github.com/M4RC3LO5/salvadoshop)
- Banco de dados: Supabase (projeto `salvadoshop`, região São Paulo)
- Imagens: Cloudinary (cloud `dtuclb3q1`)
---
## Como rodar localmente
### Pré-requisitos
- Node.js 18 ou superior
- npm ou yarn
- Conta no Supabase com acesso ao projeto `salvadoshop`
- Arquivo `.env.local` configurado (ver seção [Variáveis de ambiente](#variáveis-de-ambiente))
### Passo a passo
```bash
# 1. Clone o repositório
git clone https://github.com/M4RC3LO5/salvadoshop.git
cd salvadoshop
# 2. Instale as dependências
npm install
# 3. Configure as variáveis de ambiente
# Copie o arquivo de exemplo e preencha com as credenciais reais
cp .env.example .env.local
# 4. Rode o servidor de desenvolvimento
npm run dev
# 5. Acesse no navegador
# http://localhost:3000
```
### Comandos úteis
```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Roda o build de produção localmente
npm run type-check   # Verifica erros de TypeScript
npm run lint         # Verifica erros de lint
```
---
## Estrutura do sistema
O sistema tem três áreas distintas:
### Área Pública (clientes)
| Página | URL | Descrição |
|---|---|---|
| Home / Vitrine | `/` | Lista todos os produtos com filtros |
| Produto individual | `/produto/[slug]` | Detalhes + botões de compra (ML ou Site) |
| Lote | `/lotes/[slug]` | Detalhes do lote + botão WhatsApp |
| Carrinho | `/carrinho` | Resumo dos itens e cálculo de frete |
| Checkout | `/checkout` | Pagamento via Pix ou Cartão |
| Login / Cadastro | `/conta` | Área do cliente |
### Área Administrativa (funcionários)
| Página | URL | Quem acessa |
|---|---|---|
| Dashboard | `/admin` | Master e Auxiliar |
| Lista de produtos | `/admin/produtos` | Master e Auxiliar |
| Cadastro de produto | `/admin/produtos/novo` | Master e Auxiliar |
| Fila de aprovações | `/admin/aprovacoes` | Somente Master |
| Gestão de usuários | `/admin/usuarios` | Somente Master |
| Relatórios | `/admin/relatorios` | Somente Master |
### Popups de compra
| Tipo | Gatilho | Comportamento |
|---|---|---|
| Comparação ML vs Site | Clicar em "Comprar" (Tipo A) | Exibe os dois preços lado a lado para o cliente escolher |
| Confirmação WhatsApp | Clicar em "Vamos Negociar?" (Tipo B) | Abre WhatsApp com mensagem pré-formatada |
---
## Regras de negócio
### Cálculo de preço — Tipo A
O desconto do site é **sempre calculado automaticamente**. Nunca inserir manualmente.
```
Preço ML:   valor cadastrado pelo admin
Preço Site: preço ML × 0.82  (18% de desconto)
```
O desconto de 18% representa a taxa que o Mercado Livre cobra por venda. Ao comprar pelo site, o cliente recebe esse valor como desconto e a loja mantém a mesma margem.
### Status de produtos
| Status | Descrição | Visível no site? |
|---|---|---|
| `rascunho` | Em criação, ainda não enviado | Não |
| `pendente` | Aguardando aprovação do Master | Não |
| `publicado` | Aprovado e visível para clientes | Sim |
| `rejeitado` | Recusado pelo Master com motivo | Não |
| `vendido` | Produto vendido, fora de estoque | Não |
### Fluxo de aprovação
```
Auxiliar cadastra produto
  → Status: PENDENTE
  → Master recebe notificação
  → Master aprova → Status: PUBLICADO → aparece no site
  → Master rejeita (com motivo obrigatório) → Status: REJEITADO → Auxiliar corrige e reenvia
```
**Master** pode publicar diretamente sem passar pela fila de aprovação.
### WhatsApp — mensagem pré-formatada
Quando o cliente clica em "Vamos Negociar?" em um lote, o WhatsApp abre com:
```
Olá! Tenho interesse no lote: [Nome do Lote]
Quantidade: [X unidades]
Vi no site: salvadoshop.com.br
```
O número do WhatsApp é configurado via variável de ambiente `NEXT_PUBLIC_WHATSAPP_NUMBER`.
---
## Painel administrativo
### Perfis de acesso
**Master**
- Publica produtos diretamente
- Aprova ou rejeita alterações de Auxiliares (motivo obrigatório na rejeição)
- Cria, edita e remove usuários Auxiliares
- Acessa todos os relatórios e métricas
- Vê histórico completo de ações
**Auxiliar**
- Cadastra e edita produtos
- Faz upload e edição de imagens
- Usa o botão "Melhorar com IA" para gerar descrições
- Todas as alterações ficam como PENDENTE até aprovação do Master
- Não acessa aprovações, usuários ou relatórios
### Cadastro de produto — campos
| Campo | Tipo | Quem preenche | Obrigatório |
|---|---|---|---|
| Nome do produto | Texto simples | Funcionário | Sim |
| Especificações técnicas | Textarea livre | Funcionário | Sim |
| Descrição comercial | Rich Text (editor) | Funcionário + IA | Sim |
| Tipo | Seletor (A ou B) | Funcionário | Sim |
| Preço ML | Número | Funcionário | Sim (Tipo A) |
| Estoque / Quantidade | Número | Funcionário | Sim |
| Categoria | Seletor | Funcionário | Sim |
| Imagens | Upload múltiplo | Funcionário | Sim (mín. 1) |
### Botão "Melhorar com IA"
O campo de especificações técnicas é um rascunho livre — o funcionário joga as informações sem ordem. O botão de IA lê esse rascunho e gera uma descrição comercial profissional com efeito de streaming (texto aparecendo em tempo real).
Após a geração, o funcionário pode:
- **Substituir** o texto atual pela sugestão da IA
- **Adicionar** a sugestão ao final do texto atual
- **Descartar** e manter o texto original
### Kit de edição de imagens
Ao fazer upload, o funcionário tem acesso a:
- Recortar (formatos: livre, 1:1, 16:9, 4:3)
- Zoom + e Zoom -
- Girar 90°
- Espelhar
- Ajustar brilho, contraste, saturação e nitidez
- Auto melhorar (ajuste automático)
- Converter para preto e branco
**Botão "✨ Melhorar com IA"**
Aplica automaticamente um conjunto de transformações de IA nativas do Cloudinary — melhoria de iluminação, redução de ruído, upscaling e correção de cor — com um único clique, sem exigir nenhum conhecimento técnico do funcionário.
A melhoria é intencional e não distorce o produto: a foto continua fiel ao item real, apenas com qualidade visual superior. Isso é importante para evitar reclamações de clientes que recebem algo diferente do que viram na foto.
> **Fase futura:** avaliar IA generativa (remoção de fundo, recomposição de cena) quando o sistema estiver maduro e houver clareza sobre os limites éticos de alteração de imagem de produto.
---
## Variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis.
**Nunca commitar este arquivo.** Ele já está no `.gitignore`.
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Cloudinary
CLOUDINARY_URL=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dtuclb3q1
# Stripe (pagamento com cartão)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
# Mercado Pago (Pix)
MERCADOPAGO_ACCESS_TOKEN=
# WhatsApp
NEXT_PUBLIC_WHATSAPP_NUMBER=
# Sentry (monitoramento de erros)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
# Resend (email transacional)
RESEND_API_KEY=
```
Para obter as credenciais, fale com Marcelo.
---
## Deploy
O deploy é **automático**. A cada push na branch `main`, o Vercel faz o deploy em produção automaticamente.
### Fluxo de trabalho
```
feature/minha-feature
  → Pull Request para main
  → Revisão e aprovação
  → Merge na main
  → Vercel deploy automático
  → Produção atualizada
```
### Regras de branch
| Branch | Uso | Deploy automático? |
|---|---|---|
| `main` | Produção — nunca commitar direto | Sim → produção |
| `develop` | Integração de features | Não |
| `feature/xxx` | Nova funcionalidade | Não |
| `fix/xxx` | Correção de bug | Não |
### Verificar o deploy
- Dashboard Vercel: [vercel.com/qaseals-projects/salvadoshop](https://vercel.com/qaseals-projects/salvadoshop)
- Logs em tempo real disponíveis no dashboard
---
## Stack tecnológica
| Categoria | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 14.x |
| Linguagem | TypeScript | 5.x |
| Estilo | Tailwind CSS | 3.x |
| Componentes | shadcn/ui | latest |
| Banco de dados | Supabase (PostgreSQL) | — |
| Autenticação | Supabase Auth | — |
| Imagens | Cloudinary | — |
| Pagamento cartão | Stripe | — |
| Pagamento Pix | Mercado Pago | — |
| Email | Resend | — |
| Monitoramento | Sentry | — |
| Deploy | Vercel | — |
| IA (descrições) | Anthropic Claude (Sonnet 4.6) | — |
---
## Contato e suporte
**Dono do projeto:** Marcelo
**Email:** m4rc3lo5@gmail.com
Para dúvidas técnicas sobre o sistema, consulte primeiro o arquivo `CLAUDE.md` na raiz do projeto — ele contém todas as regras de arquitetura, segurança e negócio.
---
*Última atualização: Junho 2026*
