import { Header } from "@/components/shared/Header"
import { Footer } from "@/components/shared/Footer"
import { BannerCookies } from "@/components/shared/BannerCookies"
import { CarrinhoProvider } from "@/contexts/CarrinhoContext"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CarrinhoProvider>
      <Header />
      <main>{children}</main>
      <Footer />
      <BannerCookies />
    </CarrinhoProvider>
  )
}
