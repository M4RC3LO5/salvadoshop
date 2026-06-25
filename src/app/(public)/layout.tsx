import { Header } from "@/components/shared/Header"
import { Footer } from "@/components/shared/Footer"
import { BannerCookies } from "@/components/shared/BannerCookies"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <BannerCookies />
    </>
  )
}
