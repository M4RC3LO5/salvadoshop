"use client"

import Image from "next/image"

export interface ProdutoTipoB {
  id: string
  slug: string
  nome: string
  quantidade: number
  unidade?: string
  imagemUrl?: string
  imagemAlt?: string
}

interface CardProdutoTipoBProps {
  produto: ProdutoTipoB
}

function montarMensagemWhatsApp(produto: ProdutoTipoB) {
  const unidade = produto.unidade ?? "unidades"
  const mensagem = `Olá! Tenho interesse no lote: ${produto.nome}\nQuantidade: ${produto.quantidade} ${unidade}\nVi no site: salvadoshop.com.br`
  return encodeURIComponent(mensagem)
}

export function CardProdutoTipoB({ produto }: CardProdutoTipoBProps) {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
  const mensagem = montarMensagemWhatsApp(produto)
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${mensagem}`
  const unidade = produto.unidade ?? "unidades"

  return (
    <article className="flex flex-col bg-white border border-marrom-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">

      {/* Imagem */}
      <div className="relative w-full aspect-square bg-zinc-100">
        {produto.imagemUrl ? (
          <Image
            src={produto.imagemUrl}
            alt={produto.imagemAlt ?? produto.nome}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Badge Lote */}
        <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider bg-green-600 text-white px-2 py-0.5 rounded-full">
          Lote
        </span>
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col gap-3 p-4 flex-1">

        {/* Nome + quantidade */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-sm font-semibold text-marrom-800 leading-snug line-clamp-2">
            {produto.nome}
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {produto.quantidade} {unidade}
          </p>
        </div>

        {/* Tag público-alvo */}
        <span className="text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full w-fit">
          Para lojas e investidores
        </span>

        {/* Preço */}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-zinc-500 italic">Preço sob consulta</p>
          <p className="text-[11px] text-zinc-400">Negociação direta via WhatsApp</p>
        </div>

        {/* Botão WhatsApp */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Negociar lote: ${produto.nome}`}
          className="mt-auto w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          Vamos Negociar?
        </a>
      </div>
    </article>
  )
}
