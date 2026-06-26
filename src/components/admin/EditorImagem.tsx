"use client"

import { useState, useRef } from "react"
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import {
  X,
  RotateCw,
  FlipHorizontal2,
  ZoomIn,
  ZoomOut,
  Crop as CropIcon,
  Sparkles,
  Wand2,
  RefreshCcw,
} from "lucide-react"

// ─── Constantes ───────────────────────────────────────────────────────────────

const CLOUD_NAME = "dtuclb3q1"

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AspectMode = "livre" | "1:1" | "16:9" | "4:3"
type ModoIa = "none" | "auto" | "ia"

interface Transforms {
  brilho: number      // -100 a +100
  contraste: number   // -100 a +100
  saturacao: number   // -100 a +100
  nitidez: number     //   0 a 100
  rotacao: number     // 0 | 90 | 180 | 270
  espelhar: boolean
  modoIa: ModoIa
}

const DEFAULT_TRANSFORMS: Transforms = {
  brilho: 0, contraste: 0, saturacao: 0, nitidez: 0,
  rotacao: 0, espelhar: false, modoIa: "none",
}

const ASPECT_MAP: Record<AspectMode, number | undefined> = {
  "livre": undefined,
  "1:1":   1,
  "16:9":  16 / 9,
  "4:3":   4 / 3,
}

// ─── URL Builder ─────────────────────────────────────────────────────────────

function buildUrl(
  publicId: string,
  transforms: Transforms,
  completedCrop: PixelCrop | null,
  naturalW: number,
  naturalH: number,
  displayW: number,
  displayH: number,
): string {
  const parts: string[] = []

  // Recorte (deve ser a primeira transformação)
  if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && displayW > 0) {
    const sx = naturalW / displayW
    const sy = naturalH / displayH
    const x = Math.round(completedCrop.x * sx)
    const y = Math.round(completedCrop.y * sy)
    const w = Math.round(completedCrop.width * sx)
    const h = Math.round(completedCrop.height * sy)
    parts.push(`c_crop,g_north_west,x_${x},y_${y},w_${w},h_${h}`)
  }

  if (transforms.rotacao > 0) parts.push(`a_${transforms.rotacao}`)
  if (transforms.espelhar) parts.push("e_hflip")

  if (transforms.modoIa === "auto") {
    parts.push("e_auto_brightness,e_auto_contrast,e_auto_color")
  } else if (transforms.modoIa === "ia") {
    parts.push("e_improve,e_sharpen")
  } else {
    if (transforms.brilho    !== 0) parts.push(`e_brightness:${transforms.brilho}`)
    if (transforms.contraste !== 0) parts.push(`e_contrast:${transforms.contraste}`)
    if (transforms.saturacao !== 0) parts.push(`e_saturation:${transforms.saturacao}`)
    if (transforms.nitidez   !== 0) parts.push(`e_sharpen:${transforms.nitidez}`)
  }

  const t = parts.join(",")
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload${t ? "/" + t : ""}/${publicId}`
}

// ─── Slider de ajuste ────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, onChange }: SliderProps) {
  const modificado = value !== 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-stone-400">{label}</span>
        <span className={`text-xs tabular-nums ${modificado ? "font-semibold text-amber-400" : "text-stone-500"}`}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-amber-500"
        aria-label={label}
      />
    </div>
  )
}

// ─── Botão da toolbar ────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick: () => void
  label: string
  active?: boolean
  children: React.ReactNode
}

function ToolbarBtn({ onClick, label, active, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
        active
          ? "bg-amber-700 text-white"
          : "text-stone-400 hover:bg-stone-700 hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}

// ─── EditorImagem ─────────────────────────────────────────────────────────────

export interface EditorImagemProps {
  imagem: { url: string; public_id: string }
  onSalvar: (novaUrl: string) => void
  onCancelar: () => void
}

export function EditorImagem({ imagem, onSalvar, onCancelar }: EditorImagemProps) {
  const [transforms, setTransforms] = useState<Transforms>(DEFAULT_TRANSFORMS)
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [aspectMode, setAspectMode] = useState<AspectMode>("livre")
  const [cropAtivo, setCropAtivo] = useState(false)
  const [naturalDims, setNaturalDims] = useState({ w: 0, h: 0 })
  const [displayDims, setDisplayDims] = useState({ w: 0, h: 0 })

  const imgRef = useRef<HTMLImageElement>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  function set<K extends keyof Transforms>(key: K, value: Transforms[K]) {
    setTransforms((prev) => ({ ...prev, [key]: value }))
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight })
    setDisplayDims({ w: img.offsetWidth, h: img.offsetHeight })
  }

  function ativarCrop(mode: AspectMode) {
    setAspectMode(mode)
    setCrop(undefined)
    setCompletedCrop(null)
    setCropAtivo(true)

    const aspect = ASPECT_MAP[mode]
    if (aspect && imgRef.current) {
      const { offsetWidth, offsetHeight } = imgRef.current
      setCrop(
        centerCrop(
          makeAspectCrop({ unit: "%", width: 80 }, aspect, offsetWidth, offsetHeight),
          offsetWidth,
          offsetHeight,
        ),
      )
    }
  }

  function desativarCrop() {
    setCropAtivo(false)
    setCrop(undefined)
    setCompletedCrop(null)
  }

  function girar() {
    set("rotacao", ((transforms.rotacao + 90) % 360) as 0 | 90 | 180 | 270)
  }

  function resetar() {
    setTransforms(DEFAULT_TRANSFORMS)
    setCrop(undefined)
    setCompletedCrop(null)
    setCropAtivo(false)
    setAspectMode("livre")
    setZoom(1)
  }

  function handleSalvar() {
    const url = buildUrl(
      imagem.public_id,
      transforms,
      completedCrop,
      naturalDims.w,
      naturalDims.h,
      displayDims.w,
      displayDims.h,
    )
    onSalvar(url)
  }

  // ── Preview URL (sem recorte em modo crop — mostra original para seleção) ───

  const previewUrl = cropAtivo
    ? imagem.url
    : buildUrl(
        imagem.public_id,
        transforms,
        completedCrop,
        naturalDims.w,
        naturalDims.h,
        displayDims.w,
        displayDims.h,
      )

  const hasChanges =
    JSON.stringify(transforms) !== JSON.stringify(DEFAULT_TRANSFORMS) ||
    (completedCrop !== null && completedCrop.width > 0)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-stone-900"
      role="dialog"
      aria-modal="true"
      aria-label="Editor de imagem"
    >
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-stone-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Fechar editor"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-white"
          >
            <X size={18} />
          </button>
          <h2 className="text-sm font-semibold text-white">Editor de Imagem</h2>
          {hasChanges && (
            <span className="rounded-full bg-amber-700/30 px-2 py-0.5 text-xs text-amber-400">
              Editado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetar}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 rounded-lg border border-stone-600 px-3 py-1.5 text-xs font-medium text-stone-300 transition hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={12} aria-hidden="true" />
            Resetar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
          >
            Salvar edição
          </button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-700 bg-stone-800 px-4 py-2">

        {/* Recorte */}
        <div className="flex items-center gap-1 rounded-lg border border-stone-700 px-1 py-1">
          <CropIcon size={12} className="text-stone-500 ml-1" aria-hidden="true" />
          {(["livre", "1:1", "16:9", "4:3"] as AspectMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => ativarCrop(mode)}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                cropAtivo && aspectMode === mode
                  ? "bg-amber-700 text-white"
                  : "text-stone-400 hover:bg-stone-700 hover:text-white"
              }`}
            >
              {mode === "livre" ? "Livre" : mode}
            </button>
          ))}
          {cropAtivo && (
            <button
              type="button"
              onClick={desativarCrop}
              aria-label="Cancelar recorte"
              className="ml-0.5 rounded px-1.5 py-1 text-xs text-stone-500 hover:text-red-400 transition"
            >
              ✕
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-stone-700" aria-hidden="true" />

        <ToolbarBtn onClick={girar} label="Girar 90° horário">
          <RotateCw size={16} />
        </ToolbarBtn>

        <ToolbarBtn
          onClick={() => set("espelhar", !transforms.espelhar)}
          label="Espelhar horizontalmente"
          active={transforms.espelhar}
        >
          <FlipHorizontal2 size={16} />
        </ToolbarBtn>

        <div className="h-5 w-px bg-stone-700" aria-hidden="true" />

        <ToolbarBtn onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} label="Aproximar">
          <ZoomIn size={16} />
        </ToolbarBtn>
        <span className="min-w-[3rem] text-center text-xs text-stone-400">
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarBtn onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} label="Afastar">
          <ZoomOut size={16} />
        </ToolbarBtn>

        {transforms.rotacao > 0 && (
          <span className="ml-auto text-xs text-amber-400">{transforms.rotacao}°</span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Área da imagem ── */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-stone-950 p-6">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s ease" }}>
            {cropAtivo ? (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => {
                  setCompletedCrop(c)
                  if (imgRef.current) {
                    setDisplayDims({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight })
                  }
                }}
                aspect={ASPECT_MAP[aspectMode]}
              >
                {/*
                  react-image-crop requer <img> puro — next/image não é compatível
                  com o mecanismo de wrap interno do ReactCrop (v11).
                  Esta é a única exceção ao uso de next/image neste projeto.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imagem.url}
                  alt="Imagem em edição"
                  onLoad={onImageLoad}
                  className="max-h-[calc(100vh-200px)] max-w-full object-contain"
                  style={{
                    transform: [
                      transforms.espelhar ? "scaleX(-1)" : "",
                      transforms.rotacao   ? `rotate(${transforms.rotacao}deg)` : "",
                    ].filter(Boolean).join(" ") || undefined,
                  }}
                />
              </ReactCrop>
            ) : (
              /*
                Preview com transformações Cloudinary já aplicadas via URL.
                Usa <img> direto para evitar que o otimizador next/image
                adicione parâmetros conflitantes à URL de transformação.
              */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Preview com edições aplicadas"
                onLoad={(e) => {
                  const img = e.currentTarget
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight })
                  setDisplayDims({ w: img.offsetWidth, h: img.offsetHeight })
                }}
                className="max-h-[calc(100vh-200px)] max-w-full object-contain"
              />
            )}
          </div>
        </div>

        {/* ── Painel lateral de ajustes ── */}
        <aside
          className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-stone-700 bg-stone-800 p-4"
          aria-label="Ajustes de imagem"
        >
          {/* Sliders */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
              Ajustes
            </h3>
            <div className="flex flex-col gap-4">
              <Slider
                label="Brilho" value={transforms.brilho} min={-100} max={100}
                onChange={(v) => { set("brilho", v); set("modoIa", "none") }}
              />
              <Slider
                label="Contraste" value={transforms.contraste} min={-100} max={100}
                onChange={(v) => { set("contraste", v); set("modoIa", "none") }}
              />
              <Slider
                label="Saturação" value={transforms.saturacao} min={-100} max={100}
                onChange={(v) => { set("saturacao", v); set("modoIa", "none") }}
              />
              <Slider
                label="Nitidez" value={transforms.nitidez} min={0} max={100}
                onChange={(v) => { set("nitidez", v); set("modoIa", "none") }}
              />
            </div>
          </section>

          <div className="h-px bg-stone-700" />

          {/* Melhorias automáticas */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
              Automático
            </h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  setTransforms((prev) => ({
                    ...DEFAULT_TRANSFORMS,
                    rotacao: prev.rotacao,
                    espelhar: prev.espelhar,
                    modoIa: prev.modoIa === "auto" ? "none" : "auto",
                  }))
                }
                aria-pressed={transforms.modoIa === "auto"}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  transforms.modoIa === "auto"
                    ? "border-amber-500 bg-amber-900/30 text-amber-300"
                    : "border-stone-600 text-stone-300 hover:bg-stone-700"
                }`}
              >
                <Wand2 size={14} aria-hidden="true" />
                Auto Melhorar
              </button>

              <button
                type="button"
                onClick={() =>
                  setTransforms((prev) => ({
                    ...DEFAULT_TRANSFORMS,
                    rotacao: prev.rotacao,
                    espelhar: prev.espelhar,
                    modoIa: prev.modoIa === "ia" ? "none" : "ia",
                  }))
                }
                aria-pressed={transforms.modoIa === "ia"}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  transforms.modoIa === "ia"
                    ? "border-amber-500 bg-amber-900/30 text-amber-300"
                    : "border-stone-600 text-stone-300 hover:bg-stone-700"
                }`}
              >
                <Sparkles size={14} aria-hidden="true" />
                ✨ Melhorar com IA
              </button>

              {transforms.modoIa !== "none" && (
                <p className="text-xs leading-relaxed text-stone-500">
                  {transforms.modoIa === "auto"
                    ? "Brilho, contraste e cor ajustados automaticamente pelo Cloudinary."
                    : "Análise e melhoria avançada por IA do Cloudinary (e_improve + e_sharpen)."}
                </p>
              )}
            </div>
          </section>

          {/* Info do recorte ativo */}
          {completedCrop && completedCrop.width > 0 && (
            <>
              <div className="h-px bg-stone-700" />
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Recorte
                </h3>
                <p className="text-xs text-stone-400">
                  {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
                </p>
                <button
                  type="button"
                  onClick={() => { setCrop(undefined); setCompletedCrop(null) }}
                  className="mt-1 text-xs text-red-400 transition hover:text-red-300"
                >
                  Remover recorte
                </button>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
