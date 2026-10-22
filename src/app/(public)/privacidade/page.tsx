import type { Metadata } from "next"
import { PaginaLegal } from "@/components/shared/PaginaLegal"
import { EMPRESA_LOJA } from "@/lib/empresa-loja"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Política de Privacidade — SalvadoShop",
  description: "Como o SalvadoShop usa e protege os seus dados pessoais.",
}

export default function PaginaPrivacidade() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""

  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm="22/10/2026">
      <p>
        Aqui explicamos, em linguagem simples, quais dados seus usamos, para quê, e como
        você pode controlá-los. Seguimos a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>1. Quem é responsável pelos seus dados</h2>
      <ul>
        <li>{EMPRESA_LOJA.razaoSocial}</li>
        <li>CNPJ: {EMPRESA_LOJA.cnpj}</li>
        <li>Endereço: {EMPRESA_LOJA.endereco}</li>
        <li>E-mail: <a href={`mailto:${EMPRESA_LOJA.email}`}>{EMPRESA_LOJA.email}</a></li>
      </ul>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li>Nome, CPF, e-mail e telefone.</li>
        <li>Endereço de entrega.</li>
        <li>Os itens do seu pedido.</li>
        <li>
          Dados técnicos de acesso (como o número IP e a data e hora do acesso), registrados pela
          hospedagem do site.
        </li>
        <li>O carrinho de compras, que fica guardado no próprio navegador do cliente.</li>
      </ul>

      <h2>3. Para que usamos e em qual base legal</h2>
      <ul>
        <li>
          Registrar o pedido e fazer a entrega: execução de contrato (LGPD, art. 7º, V).
        </li>
        <li>
          CPF, para a nota fiscal e os documentos de transporte: obrigação legal (art. 7º, II).
        </li>
        <li>
          Falar com você sobre o pedido, por WhatsApp e e-mail: execução de contrato.
        </li>
        <li>
          Segurança e registros de acesso: obrigação legal, conforme o Marco Civil da Internet
          (Lei 12.965/2014).
        </li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li>
          Provedores que fazem o site funcionar: banco de dados, hospedagem e envio de e-mails.
        </li>
        <li>
          Transportadora ou Correios: nome, endereço e CPF, para a entrega.
        </li>
        <li>WhatsApp, quando você mesmo nos chama por lá.</li>
      </ul>
      <p>
        Não vendemos os seus dados. Alguns provedores podem guardar dados em servidores fora do
        Brasil, com medidas de segurança.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos somente os cookies essenciais para o site funcionar (a sessão do pedido e o
        carrinho). Não usamos cookies de publicidade nem de análise.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Guardamos os dados enquanto forem necessários para o pedido, a entrega, a garantia e os
        prazos legais e fiscais.
      </p>

      <h2>7. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode pedir para:</p>
      <ul>
        <li>confirmar que tratamos os seus dados e ter acesso a eles;</li>
        <li>corrigir dados incompletos ou errados;</li>
        <li>pedir a eliminação dos dados;</li>
        <li>pedir a portabilidade dos dados;</li>
        <li>saber com quem compartilhamos os seus dados;</li>
        <li>revogar um consentimento que tenha dado.</li>
      </ul>
      <p>
        Para exercer qualquer um desses direitos, escreva para{" "}
        <a href={`mailto:${EMPRESA_LOJA.email}`}>{EMPRESA_LOJA.email}</a>
        {whatsapp && (
          <>
            {" "}ou chame no{" "}
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        )}
        .
      </p>

      <h2>8. Encarregado de dados</h2>
      <p>
        O contato do encarregado é o mesmo e-mail da loja:{" "}
        <a href={`mailto:${EMPRESA_LOJA.email}`}>{EMPRESA_LOJA.email}</a>.
      </p>

      <h2>9. Mudanças nesta política</h2>
      <p>Se esta política mudar, publicaremos a nova versão nesta página.</p>
    </PaginaLegal>
  )
}
