"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { UFS } from "@/lib/validations/comprador"
import { ROTULO_ORIGEM, ROTULO_STATUS, formatarDataHora } from "@/lib/compradores/rotulos"
import type { SegmentoOpcao } from "./CompradoresClientUI"

export interface CompradorFormValores {
  empresa: string
  pessoa_contato: string
  telefone: string
  celular: string
  celular_whatsapp: boolean
  email: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  site: string
  segmentos: number[]
  origem: string
  status: string
  observacao: string
}

const VAZIO: CompradorFormValores = {
  empresa: "",
  pessoa_contato: "",
  telefone: "",
  celular: "",
  celular_whatsapp: false,
  email: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "SP",
  site: "",
  segmentos: [],
  origem: "carteira",
  status: "cliente",
  observacao: "",
}

const CAMPO = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
const ROTULO = "mb-1 block text-sm font-medium text-stone-700"

export function CompradorForm({
  segmentos,
  id,
  inicial,
  criadoEm,
}: {
  segmentos: SegmentoOpcao[]
  id?: string
  inicial?: CompradorFormValores
  criadoEm?: string
}) {
  const router = useRouter()
  const [v, setV] = useState<CompradorFormValores>(inicial ?? VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")
  const [duplicado, setDuplicado] = useState<{ id: string; empresa: string } | null>(null)

  const editando = !!id
  const descartado = editando && v.status === "descartado"

  function set<K extends keyof CompradorFormValores>(k: K, valor: CompradorFormValores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }))
  }

  function alternarSegmento(sid: number) {
    setV((prev) => ({
      ...prev,
      segmentos: prev.segmentos.includes(sid) ? prev.segmentos.filter((x) => x !== sid) : [...prev.segmentos, sid],
    }))
  }

  async function salvar(forcar: boolean) {
    if (salvando) return
    setErro("")
    setDuplicado(null)
    if (!v.empresa.trim()) {
      setErro("Informe o nome da empresa.")
      return
    }
    setSalvando(true)
    try {
      const corpo: Record<string, unknown> = {
        empresa: v.empresa,
        pessoa_contato: v.pessoa_contato,
        telefone: v.telefone,
        celular: v.celular,
        celular_whatsapp: v.celular_whatsapp,
        email: v.email,
        endereco: v.endereco,
        bairro: v.bairro,
        cidade: v.cidade,
        uf: v.uf || null,
        site: v.site,
        segmentos: v.segmentos,
        status: v.status,
        observacao: v.observacao,
      }
      if (!editando) corpo.origem = v.origem
      if (forcar) corpo.forcar = true

      const res = await fetch(editando ? `/api/admin/compradores/${id}` : "/api/admin/compradores", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
      const json = await res.json()
      if (res.status === 409 && json.error?.code === "DUPLICADO") {
        setDuplicado(json.data)
        return
      }
      if (!res.ok || !json.success) {
        setErro(json.error?.message ?? "Erro ao salvar.")
        return
      }
      router.push("/admin/compradores?salvo=1")
      router.refresh()
    } catch {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-stone-900">{editando ? "Editar comprador" : "Novo comprador"}</h1>
      {criadoEm && <p className="mt-1 text-sm text-stone-600">Cadastrado em {formatarDataHora(criadoEm)}</p>}

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar(false)
        }}
      >
        <div>
          <label htmlFor="c-empresa" className={ROTULO}>Empresa *</label>
          <input id="c-empresa" required maxLength={200} value={v.empresa} onChange={(e) => set("empresa", e.target.value)} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="c-contato" className={ROTULO}>Pessoa de contato</label>
          <input id="c-contato" maxLength={120} value={v.pessoa_contato} onChange={(e) => set("pessoa_contato", e.target.value)} className={CAMPO} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-telefone" className={ROTULO}>Telefone</label>
            <input id="c-telefone" type="tel" maxLength={30} value={v.telefone} onChange={(e) => set("telefone", e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="c-celular" className={ROTULO}>Celular</label>
            <input id="c-celular" type="tel" maxLength={30} value={v.celular} onChange={(e) => set("celular", e.target.value)} className={CAMPO} />
            <label className="mt-2 flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={v.celular_whatsapp}
                onChange={(e) => set("celular_whatsapp", e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 accent-amber-700"
              />
              Este celular tem WhatsApp
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="c-email" className={ROTULO}>E-mail</label>
          <input id="c-email" type="email" maxLength={200} value={v.email} onChange={(e) => set("email", e.target.value)} className={CAMPO} />
        </div>

        <div>
          <label htmlFor="c-endereco" className={ROTULO}>Endereço</label>
          <input id="c-endereco" maxLength={300} value={v.endereco} onChange={(e) => set("endereco", e.target.value)} className={CAMPO} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <div>
            <label htmlFor="c-bairro" className={ROTULO}>Bairro</label>
            <input id="c-bairro" maxLength={120} value={v.bairro} onChange={(e) => set("bairro", e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="c-cidade" className={ROTULO}>Cidade</label>
            <input id="c-cidade" maxLength={120} value={v.cidade} onChange={(e) => set("cidade", e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="c-uf" className={ROTULO}>UF</label>
            <select id="c-uf" value={v.uf} onChange={(e) => set("uf", e.target.value)} className={CAMPO}>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="c-site" className={ROTULO}>Site</label>
          <input id="c-site" maxLength={300} value={v.site} onChange={(e) => set("site", e.target.value)} className={CAMPO} />
        </div>

        <fieldset>
          <legend className={ROTULO}>Segmentos que compra</legend>
          <div className="flex flex-wrap gap-2">
            {segmentos.map((s) => {
              const marcado = v.segmentos.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  onClick={() => alternarSegmento(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    marcado
                      ? "border-amber-700 bg-amber-700 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {s.nome}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-origem" className={ROTULO}>Como chegou até nós</label>
            {editando ? (
              <p id="c-origem" className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
                {ROTULO_ORIGEM[v.origem] ?? v.origem}
              </p>
            ) : (
              <select id="c-origem" value={v.origem} onChange={(e) => set("origem", e.target.value)} className={CAMPO}>
                {Object.entries(ROTULO_ORIGEM).map(([val, r]) => <option key={val} value={val}>{r}</option>)}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="c-status" className={ROTULO}>Status</label>
            {descartado ? (
              <p id="c-status" className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
                {ROTULO_STATUS.descartado}
              </p>
            ) : (
              <select id="c-status" value={v.status} onChange={(e) => set("status", e.target.value)} className={CAMPO}>
                <option value="cliente">{ROTULO_STATUS.cliente}</option>
                <option value="contato">{ROTULO_STATUS.contato}</option>
                <option value="lead">{ROTULO_STATUS.lead}</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="c-obs" className={ROTULO}>Observação</label>
          <textarea id="c-obs" rows={4} maxLength={2000} value={v.observacao} onChange={(e) => set("observacao", e.target.value)} className={CAMPO} />
        </div>

        {erro && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {duplicado && (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-stone-800">
            <p className="font-medium">Já existe {duplicado.empresa} com esse telefone.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/admin/compradores/${duplicado.id}`}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Abrir cadastro existente
              </Link>
              <button
                type="button"
                onClick={() => void salvar(true)}
                disabled={salvando}
                className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/admin/compradores"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  )
}
