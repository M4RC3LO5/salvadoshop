import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SalvadoShop",
  description: "E-commerce de produtos salvados",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/site-192.png", apple: "/icons/site-apple-180.png" },
  appleWebApp: { capable: true, title: "SalvadoShop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7c3f1e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geistSans.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
