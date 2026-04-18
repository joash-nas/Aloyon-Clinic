//src/components/footer/SiteFooter.tsx
"use client";

import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 border-t border-[var(--border)] bg-[#f7f8ef]/70">
      <div className="container py-8 md:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand / intro */}
          <div>
            <div className="text-base font-semibold tracking-tight">
              Aloyon <span style={{ color: "var(--primary)" }}>Optical</span>
            </div>
            <p className="mt-3 text-sm text-muted max-w-xs leading-6">
              Shop frames, explore new arrivals, and try styles online with our
              virtual try-on experience.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold">Quick links</h4>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/" className="link-muted">
                Home
              </Link>
              <Link href="/shop" className="link-muted">
                Shop
              </Link>
              <Link href="/about" className="link-muted">
                About
              </Link>
              <Link href="/virtual-try-on" className="link-muted">
                Virtual Try-On
              </Link>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm font-semibold">Shop</h4>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/shop?type=frames" className="link-muted">
                Frames
              </Link>
              <Link href="/shop?type=contact-lens" className="link-muted">
                Contact-lens
              </Link>
              <Link href="/shop?type=eyedrops" className="link-muted">
                Eyedrops
              </Link>
            </div>
          </div>

          {/* Contact / info */}
          <div>
            <h4 className="text-sm font-semibold">Visit or contact</h4>
            <div className="mt-3 space-y-2 text-sm text-muted leading-6">
              <p>Need help finding your perfect pair?</p>
              <p>Email: susan.aloyon@yahoo.com</p>
              <p>Phone: +63 912 345 6789</p>
              <p>Store hours: Mon–Sat, 9:00 AM – 5:00 PM</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted">
          <span>© {year} Aloyon Optical. All rights reserved.</span>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/shop" className="link-muted">
              Browse products
            </Link>
            <Link href="/virtual-try-on" className="link-muted">
              Try frames online
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}