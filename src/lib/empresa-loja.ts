// Fonte unica dos dados da empresa vendedora exibidos no site (rodape e
// paginas legais). Os campos marcados PENDENTE ainda sao ficticios e devem ser
// trocados antes de abrir a loja ao publico (ver BACKLOG).
export const EMPRESA_LOJA = {
  razaoSocial: "SalvadoShop Comércio Ltda.", // PENDENTE: confirmar
  cnpj: "00.000.000/0001-00", // PENDENTE: confirmar
  endereco:
    "Rua Fernandes da Silva Bueno, 176 — Vila Ponte Rasa, São Paulo/SP — CEP 03882-000",
  email: "contato@lojadossalvados.com.br", // PENDENTE: confirmar
  mercadoLivreUrl:
    "https://lista.mercadolivre.com.br/comercial-dantas_CustId_477940563_NoIndex_True?sb=seller_id",
} as const
