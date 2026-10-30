import { COR_CABECALHO } from "./empresa"

// Atenção: nada de aspas (' ou ") neste CSS. O React escapa aspas no texto de <style>
// (&quot;), o navegador não decodifica, e a hidratação quebra. A regra @page com o
// número da página tem aspas e por isso vai separada (FOLHA_CSS_PAGINA), injetada no cliente.
// CSS da folha A4 da Lista de Venda (Comercial Dantas). É a ÚNICA definição:
// a mesma folha aparece na tela de edição e sai no papel (window.print).
// Regras só de tela ficam em @media screen; o que é de edição (contornos de
// campo, calha de controles, alças de largura, destaque de linha sem preço)
// nunca vai para o papel. No papel, cada campo editável é trocado por um texto
// (.so-papel) para o resultado ser idêntico à impressão antiga.
export const FOLHA_CSS = `
@media print {
  html, body { background: #fff !important; }
}
.lista-folha { font-family: Calibri, Carlito, Arial, sans-serif; color: #000; }
.folha { background: #fff; width: 210mm; flex: none; margin: 0 auto; padding: 8mm; box-sizing: border-box; display: flex; flex-direction: column; min-height: 297mm; }
@media print { .folha { width: auto; padding: 0; margin: 0; min-height: 277mm; } }
.folha table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
.folha thead { display: table-header-group; }
.folha tr { break-inside: avoid; page-break-inside: avoid; }
.folha th, .folha td { border: 1px solid #000; padding: 0.9mm 0.9mm; }
.folha th { white-space: nowrap; position: relative; }
.alca { position: absolute; top: 0; right: 0; width: 8px; height: 100%; cursor: col-resize; z-index: 2; touch-action: none; user-select: none; background: linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.28)) no-repeat 100% 50% / 2px 60%; }
.alca:hover, .alca:focus-visible { background-image: linear-gradient(#b45309, #b45309); background-size: 3px 60%; }
.alca:focus-visible { outline: none; }
@media print { .alca { display: none !important; } }
.folha td { overflow: hidden; word-break: break-word; }
.folha td.num { white-space: nowrap; }
.folha td.apertada { font-size: 8pt; }
.folha td.fab { font-size: 8.5pt; }
.folha td { border-top-color: #9a9a9a; border-bottom-color: #9a9a9a; vertical-align: bottom; height: 4.9mm; overflow-wrap: anywhere; }
.folha th { background: #${COR_CABECALHO}; font-family: Arial Black, Arial, sans-serif; font-weight: 900; font-size: 9pt; text-align: center; }
.folha th.titulo { text-decoration: underline; border-bottom: 1px solid #000; }
.folha td.centro { text-align: center; }
.folha td.direita { text-align: left; }
.folha td.longa { font-size: 7.5pt; }
.total-geral { text-align: right; font-weight: 700; font-size: 10.2pt; margin-top: 1mm; padding-right: 1mm; }
.aviso { text-align: center; font-family: Arial, sans-serif; font-weight: 700; font-style: italic; text-decoration: underline; font-size: 11.2pt; margin-top: 7mm; white-space: pre-line; }
.rodape-empresa { margin-top: auto; padding-top: 8mm; text-align: center; font-family: Arial, sans-serif; font-size: 9.4pt; }

/* Campos editaveis: na tela parecem o texto da folha; no papel viram .so-papel */
.folha .edit { display: block; width: 100%; box-sizing: border-box; margin: 0; padding: 0; border: 0; border-radius: 2px; background: transparent; font: inherit; color: inherit; text-align: inherit; text-decoration: inherit; font-style: inherit; line-height: 1.2; resize: none; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
.folha .edit:hover { background: rgba(0,0,0,.05); }
.folha .edit:focus { outline: 2px solid #b45309; outline-offset: 1px; background: #fff; position: relative; z-index: 4; }
.folha .so-papel { display: none; }
.folha .qtd-edit { display: flex; align-items: center; justify-content: center; gap: 2px; }
.folha .qtd-edit .edit { text-align: center; min-width: 0; }
.folha .calha { display: none; }
@media print {
  .folha .edit, .folha .calha { display: none !important; }
  .folha .so-papel { display: block; }
  .folha td.num .so-papel, .folha .qtd-papel { white-space: nowrap; }
  .folha th.titulo .so-papel { text-decoration: underline; }
}
@media screen {
  .folha-area { width: max-content; margin: 0 auto; padding-left: 48px; }
  .folha { box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  /* Bordas separadas (não colapsadas) para o título e o cabeçalho fixos não perderem as linhas ao rolar */
  .folha table { border-collapse: separate; border-spacing: 0; }
  .folha th, .folha td { border-width: 0 1px 1px 0; }
  .folha th:first-child, .folha td:first-child { border-left-width: 1px; }
  .folha thead tr:first-child th { border-top-width: 1px; }
  .folha thead th { position: sticky; z-index: 3; }
  .folha thead tr:first-child th { top: 0; }
  .folha thead tr:nth-child(2) th { top: var(--h-titulo, 28px); }
  .folha tr.sem-preco td { background: #fffbeb; }
  .folha td.col-desc { position: relative; overflow: visible; }
  .folha .calha { display: flex; position: absolute; right: calc(100% + 6px); top: 0; gap: 1px; opacity: .55; z-index: 5; }
  .folha tr:hover .calha, .folha .calha:focus-within { opacity: 1; }
  .folha .calha button { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 1px solid #d6d3d1; border-radius: 3px; background: #fff; color: #57534e; cursor: pointer; }
  .folha .calha button:hover:not(:disabled) { background: #f5f5f4; }
  .folha .calha button.remover:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
  .folha .calha button:disabled { opacity: .3; cursor: default; }
}
`

// Regra @page (A4, margens e "Página X de Y" no rodapé de cada folha; margin box,
// Chrome/Edge 131+). A margem inferior maior reserva o espaço do número.
// Tem aspas: injetada via <style> no cliente (ver EditorListaVenda).
export const FOLHA_CSS_PAGINA =
  '@page { size: A4 portrait; margin: 8mm 8mm 12mm 8mm; @bottom-center { content: "Página " counter(page) " de " counter(pages); font-family: Arial, sans-serif; font-size: 8pt; color: #444; } }'
