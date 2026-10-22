import type { Metadata } from "next"
import { PaginaLegal } from "@/components/shared/PaginaLegal"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Trocas e Devoluções — SalvadoShop",
  description: "Prazos e regras de desistência, defeito, troca e devolução no SalvadoShop.",
}

export default function PaginaTrocas() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""

  return (
    <PaginaLegal titulo="Trocas e Devoluções" atualizadoEm="22/10/2026">
      <p>
        Estas regras valem para produtos salvados e para produtos que não são salvados, conforme o
        Código de Defesa do Consumidor (CDC).
      </p>

      <h2>1. Desistência da compra (arrependimento)</h2>
      <ul>
        <li>
          Você pode desistir em até 7 dias corridos depois de receber o produto, sem precisar dar
          motivo (CDC, art. 49).
        </li>
        <li>O produto deve ser devolvido nas condições em que foi recebido.</li>
        <li>O frete da devolução é por conta da loja.</li>
        <li>
          Devolvemos tudo o que foi pago, inclusive o frete, por Pix, em até 7 dias úteis depois
          que a loja receber o produto de volta.
        </li>
      </ul>

      <h2>2. Produto com defeito</h2>
      <p>
        A garantia legal é de 90 dias para produtos duráveis e de 30 dias para produtos não
        duráveis (CDC, art. 26). Ela vale para produtos salvados e não salvados.
      </p>

      <h2>3. O que não é defeito</h2>
      <p>
        Não é defeito a condição que foi informada no anúncio (por exemplo: caixa avariada ou um
        risco que está descrito). Qualquer outro problema é coberto.
      </p>

      <h2>4. Como pedir</h2>
      <p>
        Chame a gente no{" "}
        {whatsapp ? (
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        ) : (
          "WhatsApp"
        )}{" "}
        e informe o número do pedido, com fotos ou vídeo do problema.
      </p>
      <p>
        A loja tem até 30 dias para resolver. Se não resolver, você escolhe entre a troca por um
        produto equivalente, a devolução do dinheiro ou o abatimento no preço (CDC, art. 18).
      </p>

      <h2>5. Retirada na loja</h2>
      <p>A compra com retirada na loja segue as mesmas regras desta página.</p>
    </PaginaLegal>
  )
}
