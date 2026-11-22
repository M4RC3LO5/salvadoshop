import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Admin — SalvadoShop",
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  icons: { icon: "/icons/admin-192.png", apple: "/icons/admin-apple-180.png" },
  appleWebApp: { capable: true, title: "SS Admin", statusBarStyle: "black" },
}

export const viewport: Viewport = {
  themeColor: "#1c1917",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-stone-100">
      {children}
    </div>
  )
}
