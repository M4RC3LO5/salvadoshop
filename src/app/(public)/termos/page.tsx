import type { Metadata } from "next"
import Link from "next/link"
import { PaginaLegal } from "@/components/shared/PaginaLegal"
import { EMPRESA_LOJA } from "@/lib/empresa-loja"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Termos de Uso — SalvadoShop",
  description: "Regras de uso do site e de compra no SalvadoShop.",
}

export default function PaginaTermos() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizadoEm="22/10/2026">
      <p>
        Estas são as regras para usar o site e comprar no SalvadoShop. Leia com calma; se tiver
        dúvida, fale com a gente.
      </p>

      <h2>1. Quem somos e o que vendemos</h2>
      <p>
        O site é operado por {EMPRESA_LOJA.razaoSocial}, CNPJ {EMPRESA_LOJA.cnpj}, com endereço em{" "}
        {EMPRESA_LOJA.endereco}.
      </p>
      <p>
        Vendemos produtos salvados (que vêm de transportadoras, seguradoras e leilões da Receita
        Federal) e também produtos que não são salvados.
      </p>

      <h2>2. Condição do produto</h2>
      <p>
        Cada anúncio descreve a condição real do produto (por exemplo: caixa avariada, sem manual,
        marcas de uso), e as fotos são do próprio produto. O que está descrito no anúncio faz parte
        da compra.
      </p>

      <h2>3. Preços e estoque</h2>
      <p>
        Os preços do site podem ser diferentes dos preços do Mercado Livre. O estoque é limitado, e
        o produto pode esgotar.
      </p>

      <h2>4. Como funciona o pedido</h2>
      <ul>
        <li>Você registra o pedido no site.</li>
        <li>
          Nós calculamos o frete e enviamos pelo WhatsApp o valor total (produtos mais frete) e as
          instruções de pagamento, antes de qualquer pagamento.
        </li>
        <li>O pagamento é somente via Pix.</li>
        <li>A retirada na loja está disponível e é combinada pelo WhatsApp.</li>
      </ul>

      <h2>5. Lotes para revendedores</h2>
      <p>Os lotes são negociados pelo WhatsApp, fora do site.</p>

      <h2>6. Garantia, trocas e devoluções</h2>
      <p>
        Você pode desistir da compra em até 7 dias corridos após receber o produto e tem garantia
        contra defeitos, conforme o Código de Defesa do Consumidor. Os detalhes estão em{" "}
        <Link href="/trocas">Trocas e Devoluções</Link>.
      </p>

      <h2>7. Foro</h2>
      <p>
        Para resolver qualquer questão sobre a compra, vale o foro do domicílio do consumidor,
        conforme o Código de Defesa do Consumidor.
      </p>
    </PaginaLegal>
  )
}
