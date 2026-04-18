// src/components/cart/CartLink.tsx

"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

export default function CartLink() {
  const { items } = useCart();
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <Link href="/cart" className="relative btn btn-ghost" aria-label="Cart">
      🛍️ Cart
      {count > 0 && (
        <span
          className="absolute -top-2 -right-2 text-xs font-semibold rounded-full px-2 py-0.5"
          style={{ background: "var(--primary)", color: "var(--primary-ink)" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
