import { CarrinhoProvider } from "@/contexts/CarrinhoContext"

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <CarrinhoProvider>{children}</CarrinhoProvider>
}
