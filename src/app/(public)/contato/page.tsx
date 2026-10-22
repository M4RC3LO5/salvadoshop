import type { Metadata } from "next"
import { PaginaLegal } from "@/components/shared/PaginaLegal"
import { EMPRESA_LOJA } from "@/lib/empresa-loja"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Contato — SalvadoShop",
  description: "Fale com o SalvadoShop pelo WhatsApp, e-mail ou na loja.",
}

export default function PaginaContato() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""

  return (
    <PaginaLegal titulo="Contato">
      {whatsapp && (
        <div>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar pelo WhatsApp"
            className="inline-flex items-center bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors no-underline"
          >
            Chamar no WhatsApp
          </a>
        </div>
      )}

      <h2>E-mail</h2>
      <p>
        <a href={`mailto:${EMPRESA_LOJA.email}`}>{EMPRESA_LOJA.email}</a>
      </p>

      <h2>Endereço</h2>
      <p>{EMPRESA_LOJA.endereco}</p>

      <h2>Nossa loja no Mercado Livre</h2>
      <p>
        <a href={EMPRESA_LOJA.mercadoLivreUrl} target="_blank" rel="noopener noreferrer">
          Ver a loja no Mercado Livre
        </a>
      </p>
    </PaginaLegal>
  )
}
