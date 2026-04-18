// src/components/nav/Navbar.tsx

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import AvatarMenu from "@/components/nav/AvatarMenu";
import CartLink from "@/components/cart/CartLink";

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (!open) return;
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const mobileItemBase =
    "block px-4 py-3 text-sm no-underline transition text-neutral-900";
  const mobileItemActive = "bg-[var(--primary)]/14 font-medium";
  const mobileItemIdle = "hover:bg-black/5";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[#f7f8ef]/90 backdrop-blur">
      <div className="container h-14 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="font-semibold tracking-tight no-underline text-inherit"
        >
          Aloyon <span style={{ color: "var(--primary)" }}>Optical</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link className="link-muted" href="/">
            Home
          </Link>
          <Link className="link-muted" href="/shop">
            Shop
          </Link>
          <Link className="link-muted" href="/about">
            About
          </Link>
        </nav>

        {/* Right side */}
        <nav className="flex items-center gap-2 sm:gap-3" ref={panelRef}>
          {/* Mobile menu */}
          <div className="relative md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="rounded-xl px-3 py-2 text-neutral-900 ring-1 ring-[#d7dacb] bg-[#f7f8ef]/95 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <span className="block w-5 h-[2px] bg-current mb-1" />
              <span className="block w-5 h-[2px] bg-current mb-1" />
              <span className="block w-5 h-[2px] bg-current" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 z-50 w-44 overflow-hidden rounded-2xl border border-[#d7dacb] bg-[#f7f8ef]/98 text-neutral-900 shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
                <Link
                  href="/"
                  className={`${mobileItemBase} ${
                    isActive("/") ? mobileItemActive : mobileItemIdle
                  }`}
                >
                  Home
                </Link>

                <Link
                  href="/shop"
                  className={`${mobileItemBase} border-t border-[#e3e5da] ${
                    isActive("/shop") ? mobileItemActive : mobileItemIdle
                  }`}
                >
                  Shop
                </Link>

                <Link
                  href="/about"
                  className={`${mobileItemBase} border-t border-[#e3e5da] ${
                    isActive("/about") ? mobileItemActive : mobileItemIdle
                  }`}
                >
                  About
                </Link>
              </div>
            )}
          </div>

          {user && <CartLink />}
          <AvatarMenu />
        </nav>
      </div>
    </header>
  );
}