// Gera o payload Pix "Copia e Cola" no padrão BR Code (EMV), conforme o
// manual do BACEN, sem depender de nenhuma API externa — só string TLV +
// CRC16. Usado tanto para o campo copia-e-cola quanto para desenhar o QR Code
// (a lib `qrcode` só desenha a imagem a partir deste payload).

// Faixa Unicode dos diacríticos combinantes (U+0300–U+036F) após normalize('NFD').
// Construída via charCode (em vez do literal /[\uXXXX-\uXXXX]/) para evitar
// qualquer ambiguidade de encoding no arquivo fonte.
const REGEX_DIACRITICOS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g'
)

function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(REGEX_DIACRITICOS, '')
}

// Restringe a um subconjunto seguro de ASCII (letras, números, espaço) —
// os campos de nome/cidade do BR Code não suportam acentuação nem símbolos.
function sanitizarCampoEmv(valor: string, tamanhoMaximo: number): string {
  return removerAcentos(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, tamanhoMaximo)
}

function tlv(id: string, valor: string): string {
  const tamanho = valor.length.toString().padStart(2, '0')
  return `${id}${tamanho}${valor}`
}

// CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — o algoritmo exigido pelo
// BACEN para o campo final do payload.
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface DadosPixBRCode {
  chave: string
  beneficiario: string
  cidade: string
  valor: number
  // Identificador do pedido — vira o txid (Reference Label), só alfanumérico.
  txid: string
}

export function gerarPixBRCode({ chave, beneficiario, cidade, valor, txid }: DadosPixBRCode): string {
  const merchantAccountInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)
  const txidSanitizado = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'

  const semCrc =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '11') + // Point of Initiation Method — estático
    tlv('26', merchantAccountInfo) +
    tlv('52', '0000') + // Merchant Category Code
    tlv('53', '986') + // Moeda — BRL
    tlv('54', valor.toFixed(2)) + // Valor
    tlv('58', 'BR') + // País
    tlv('59', sanitizarCampoEmv(beneficiario, 25) || 'SALVADOSHOP') + // Nome do beneficiário
    tlv('60', sanitizarCampoEmv(cidade, 15) || 'SAO PAULO') + // Cidade
    tlv('62', tlv('05', txidSanitizado)) + // Additional Data Field Template (txid)
    '6304' // id + tamanho do campo CRC — o valor do CRC ainda não entra aqui

  return semCrc + crc16(semCrc)
}
