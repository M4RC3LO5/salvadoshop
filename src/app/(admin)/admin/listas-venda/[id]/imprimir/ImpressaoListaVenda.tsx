"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, Printer, RotateCcw } from "lucide-react"
import { precoCaixa, totalGeral, totalItem } from "@/lib/utils/lista-venda"
import { EMPRESA, LIMITE_DESCRICAO_LONGA } from "@/lib/lista-venda/empresa"
import {
  COLUNAS_LISTA,
  LARGURAS_PADRAO,
  redimensionar,
  type LargurasColunas,
} from "@/lib/lista-venda/larguras"

export interface ItemImpressao {
  id: string
  descricao: string
  fabricante: string | null
  referencia: string | null
  vencimento: string | null
  qtd_caixas: number
  unid_por_caixa: number
  preco_unitario: number | null
}

type EstadoSalvo = "ocioso" | "salvando" | "salvo" | "erro"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const ATRASO_SALVAR_MS = 500
const PASSO_TECLADO_PCT = 0.5

// Valores muito grandes (ex.: R$ 1.481.400,00) usam fonte menor para caber na célula.
function Moeda({ valor }: { valor: number | null }) {
  const txt = valor === null ? "" : BRL.format(valor)
  return <td className={`direita num${txt.length > 12 ? " apertada" : ""}`}>{txt}</td>
}

export function ImpressaoListaVenda({
  listaId, titulo, rodape, itens, largurasIniciais,
}: {
  listaId: string
  titulo: string
  rodape: string
  itens: ItemImpressao[]
  largurasIniciais: LargurasColunas
}) {
  const [larguras, setLarguras] = useState(largurasIniciais)
  const [estado, setEstado] = useState<EstadoSalvo>("ocioso")
  const [mensagemErro, setMensagemErro] = useState("")
  const tabelaRef = useRef<HTMLTableElement>(null)
  const larguraAtual = useRef(larguras)
  const arraste = useRef<{ indice: number; inicioX: number; base: LargurasColunas; larguraTabela: number } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { larguraAtual.current = larguras }, [larguras])
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  const gravar = useCallback(async (valor: LargurasColunas | null) => {
    setEstado("salvando")
    setMensagemErro("")
    try {
      const res = await fetch(`/api/admin/listas-venda/${listaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ larguras_colunas: valor }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setEstado("erro")
        setMensagemErro(json.error?.message ?? "Não foi possível salvar as larguras.")
        return
      }
      setEstado("salvo")
    } catch {
      setEstado("erro")
      setMensagemErro("Erro de conexão ao salvar as larguras.")
    }
  }, [listaId])

  // Salva ao soltar a alça, com debounce (vários ajustes seguidos viram uma gravação).
  const agendarSalvar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setEstado("salvando")
    temporizador.current = setTimeout(() => gravar(larguraAtual.current), ATRASO_SALVAR_MS)
  }, [gravar])

  function iniciarArraste(e: React.PointerEvent<HTMLSpanElement>, indice: number) {
    const tabela = tabelaRef.current
    if (!tabela) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    arraste.current = {
      indice,
      inicioX: e.clientX,
      base: larguraAtual.current,
      larguraTabela: tabela.getBoundingClientRect().width,
    }
  }

  function moverArraste(e: React.PointerEvent<HTMLSpanElement>) {
    const a = arraste.current
    if (!a || a.larguraTabela <= 0) return
    const deltaPct = ((e.clientX - a.inicioX) / a.larguraTabela) * 100
    setLarguras(redimensionar(a.base, a.indice, deltaPct))
  }

  function soltarArraste(e: React.PointerEvent<HTMLSpanElement>) {
    if (!arraste.current) return
    arraste.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    agendarSalvar()
  }

  // Teclado: ← → ajustam a coluna em passos de 0,5 ponto percentual.
  function tecladoAlca(e: React.KeyboardEvent<HTMLSpanElement>, indice: number) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const passo = e.key === "ArrowRight" ? PASSO_TECLADO_PCT : -PASSO_TECLADO_PCT
    setLarguras((atual) => {
      const nova = redimensionar(atual, indice, passo)
      larguraAtual.current = nova
      return nova
    })
    agendarSalvar()
  }

  function restaurarPadrao() {
    if (temporizador.current) clearTimeout(temporizador.current)
    setLarguras({ ...LARGURAS_PADRAO })
    larguraAtual.current = { ...LARGURAS_PADRAO }
    gravar(null)
  }

  const geral = totalGeral(itens)
  const ehPadrao = COLUNAS_LISTA.every((c) => larguras[c.chave] === LARGURAS_PADRAO[c.chave])

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admin/listas-venda/${listaId}`} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a edição
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            {estado === "salvando" && <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Salvando…</>}
            {estado === "salvo" && <><Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> Larguras salvas</>}
            {estado === "erro" && <span className="text-red-600">{mensagemErro}</span>}
          </span>
          <button
            type="button"
            onClick={restaurarPadrao}
            disabled={ehPadrao || estado === "salvando"}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar padrão
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800"
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>
      <p className="mx-auto mb-2 max-w-[210mm] text-xs text-stone-500 print:hidden">
        Arraste a borda direita de um título de coluna para ajustar a largura (ou use as setas ← → com a alça focada). As larguras ficam salvas nesta lista. Para gerar PDF, escolha “Salvar como PDF” na impressora.
      </p>

      <div className="folha shadow print:shadow-none">
        <div className="mb-[9mm]">
          <Image
            src={EMPRESA.logoPublicPath}
            alt="Comercial Dantas de Salvados e Sinistros — compra e venda por atacado, desde 2004"
            width={EMPRESA.logoLargura}
            height={EMPRESA.logoAltura}
            unoptimized
            priority
            style={{ width: "100mm", height: "auto" }}
          />
        </div>

        <table ref={tabelaRef}>
          <colgroup>
            {COLUNAS_LISTA.map((c) => (
              <col key={c.chave} style={{ width: `${larguras[c.chave]}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr><th colSpan={COLUNAS_LISTA.length} className="titulo">{titulo}</th></tr>
            <tr>
              {COLUNAS_LISTA.map((c, indice) => (
                <th key={c.chave} scope="col">
                  {c.rotulo}
                  {/* Alça de arraste: só na tela, nunca no papel. A última coluna não tem (a tabela tem largura fixa). */}
                  {indice < COLUNAS_LISTA.length - 1 && (
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar a coluna ${c.rotulo}`}
                      aria-valuemin={c.minimo}
                      aria-valuenow={larguras[c.chave]}
                      tabIndex={0}
                      className="alca print:hidden"
                      onPointerDown={(e) => iniciarArraste(e, indice)}
                      onPointerMove={moverArraste}
                      onPointerUp={soltarArraste}
                      onPointerCancel={soltarArraste}
                      onKeyDown={(e) => tecladoAlca(e, indice)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const cx = precoCaixa(i)
              const total = totalItem(i)
              return (
                <tr key={i.id}>
                  <td className={i.descricao.length > LIMITE_DESCRICAO_LONGA ? "longa" : undefined}>{i.descricao}</td>
                  <td className="centro fab">{i.fabricante}</td>
                  <td className="centro">{i.referencia}</td>
                  <td className="centro">{i.vencimento}</td>
                  <td className="centro num">{i.qtd_caixas} &nbsp;x&nbsp; {i.unid_por_caixa}</td>
                  <Moeda valor={i.preco_unitario} />
                  <Moeda valor={cx} />
                  <Moeda valor={total} />
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="total-geral">{BRL.format(geral)}</div>

        <p className="aviso">{rodape}</p>

        <div className="rodape-empresa">
          {EMPRESA.linhasRodape.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </div>
      </div>
    </>
  )
}
