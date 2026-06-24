import Link from "next/link"

// TODO: substituir pelos dados reais da empresa antes do go-live
const EMPRESA = {
  cnpj: "00.000.000/0001-00",
  razaoSocial: "SalvadoShop Comércio Ltda.",
  endereco: "Rua das Mercadorias Recuperadas, 123 — São Paulo, SP — CEP 00000-000",
  email: "contato@salvadoshop.com.br",
  // TODO: substituir pela URL real da loja no Mercado Livre
  mercadoLivreUrl: "https://www.mercadolivre.com.br/",
}

export function Footer() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
  const whatsappUrl = `https://wa.me/${whatsapp}`
  const ano = new Date().getFullYear()

  return (
    <footer className="bg-marrom-800 text-marrom-100">
      <div className="container py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">

          {/* Coluna 1 — Logo e dados da empresa */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold text-white tracking-tight">SalvadoShop</span>
              <span className="text-xs text-marrom-300">Negócios de família</span>
            </div>
            <div className="text-sm space-y-1 mt-1">
              <p>{EMPRESA.razaoSocial}</p>
              <p>CNPJ: {EMPRESA.cnpj}</p>
              <p>{EMPRESA.endereco}</p>
              <a
                href={`mailto:${EMPRESA.email}`}
                className="text-ambar-400 hover:text-ambar-300 transition-colors"
              >
                {EMPRESA.email}
              </a>
            </div>
          </div>

          {/* Coluna 2 — Links úteis */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Links</h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/privacidade" className="hover:text-white transition-colors">
                Política de Privacidade
              </Link>
              <Link href="/termos" className="hover:text-white transition-colors">
                Termos de Uso
              </Link>
              <Link href="/contato" className="hover:text-white transition-colors">
                Contato
              </Link>
              <a
                href={EMPRESA.mercadoLivreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Nossa loja no Mercado Livre ↗
              </a>
            </nav>
          </div>

          {/* Coluna 3 — WhatsApp */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Fale conosco</h3>
            <p className="text-sm">
              Prefere negociar diretamente? Entre em contato pelo WhatsApp.
            </p>
            {whatsapp && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Conversar pelo WhatsApp"
                className="inline-flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors w-fit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                Chamar no WhatsApp
              </a>
            )}
          </div>

        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-marrom-700">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-marrom-400">
          <p>© {ano} SalvadoShop. Todos os direitos reservados.</p>
          <p>Feito com dedicação pela família.</p>
        </div>
      </div>
    </footer>
  )
}
