// Dados da Comercial Dantas que saem no rodapé da Lista de Venda (impressão e
// xlsx). Mantidos aqui, e não no banco, porque vêm do layout final enviado ao
// cliente. Se um dia forem para configuracoes_loja (16.3), trocar só este arquivo.

export const EMPRESA = {
  logoPublicPath: "/logo-comercial-dantas.png",
  logoLargura: 1225,
  logoAltura: 210,
  linhasRodape: [
    "Rua Fernandes da Silva Bueno 176 Vila Ponte Rasa   São Paulo SP CEP 03882-000   Fone: 11 - 2047-5395",
    "E-mail: contatocomercialdantas@gmail.com",
  ],
} as const

// Cor do cabeçalho da tabela (azul claro do layout final)
export const COR_CABECALHO = "92CDDC"

// Descrições longas saem com fonte menor, como no layout final
export const LIMITE_DESCRICAO_LONGA = 45
