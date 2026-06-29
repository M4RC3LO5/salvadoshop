"use client"

import { useState } from "react"
import Link from "next/link"
import { useCarrinho } from "@/contexts/CarrinhoContext"

const navLinks = [
  { href: "/", label: "Catálogo" },
  { href: "/lotes", label: "Lotes" },
  { href: "/contato", label: "Contato" },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { totalItens } = useCarrinho()

  return (
    <header className="bg-marrom-700 text-white shadow-md">
      <div className="container flex items-center justify-between h-16">

        {/* Logo */}
        <Link href="/" className="flex flex-col leading-tight hover:opacity-90 transition-opacity">
          <span className="text-xl font-bold tracking-tight">SalvadoShop</span>
          <span className="text-xs text-marrom-200 font-normal">Negócios de família</span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-marrom-100 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Ações direita */}
        <div className="flex items-center gap-3">
          {/* Botão Carrinho */}
          <Link
            href="/carrinho"
            aria-label={`Ver carrinho${totalItens > 0 ? ` — ${totalItens} ${totalItens === 1 ? "item" : "itens"}` : ""}`}
            className="relative flex items-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span className="hidden sm:inline">Carrinho</span>

            {/* Badge contador */}
            {totalItens > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center bg-white text-ambar-700 text-[11px] font-bold rounded-full px-1 shadow"
              >
                {totalItens > 99 ? "99+" : totalItens}
              </span>
            )}
          </Link>

          {/* Botão hamburguer — mobile */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded hover:bg-marrom-600 transition-colors"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Nav mobile */}
      {menuOpen && (
        <nav className="md:hidden border-t border-marrom-600 bg-marrom-800">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-6 py-3 text-sm font-medium text-marrom-100 hover:text-white hover:bg-marrom-700 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
