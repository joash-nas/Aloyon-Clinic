/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/components/shop/QuickAddToCart.tsx
   Purpose: Small "Add to cart" button on product cards.
   Notes:
     • Enforces stock limit per item:
         - maxQty = total stock from DB
         - respects how many are already in the cart
   ============================================================================ */
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useCart } from "@/components/cart/CartContext";

type Props = {
  productId: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
  maxQty?: number;
};

export default function QuickAddToCart({
  productId,
  name,
  price,
  image,
  inStock,
  maxQty,
}: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { add, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  // stricter auth check
  const isLoggedIn = Boolean(
    user && ((user as any).id || (user as any)._id || (user as any).email)
  );

  const existing = items.find((it) => it.productId === productId);
  const currentInCart = existing?.qty ?? 0;

  const totalStock =
    typeof maxQty === "number" && maxQty >= 0 ? maxQty : undefined;

  const remaining =
    totalStock !== undefined ? Math.max(0, totalStock - currentInCart) : undefined;

  const canAdd = inStock && (remaining === undefined ? true : remaining > 0);

  const onAdd = () => {
    if (!canAdd) {
      if (totalStock !== undefined) {
        alert(
          `Only ${totalStock} piece${totalStock === 1 ? "" : "s"} are in stock. ` +
            `You already have ${currentInCart} in your cart.`
        );
      }
      return;
    }

    if (!isLoggedIn) {
      return router.push(
        `/login?redirect=${encodeURIComponent(pathname || "/shop")}`
      );
    }

    add({ productId, name, price, image, qty: 1 });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const label = !canAdd
    ? totalStock !== undefined
      ? "Max reached"
      : "Out of stock"
    : justAdded
      ? "Added ✓"
      : "Add to cart";

  return (
    <button
      onClick={onAdd}
      disabled={!canAdd}
      className="rounded-full px-4 py-2 text-sm font-medium transition"
      style={{
        background: canAdd ? "#222" : "rgba(0,0,0,0.2)",
        color: "#fff",
        opacity: canAdd ? 1 : 0.7,
        boxShadow: canAdd ? "0 6px 18px rgba(0,0,0,0.12)" : "none",
      }}
      title={
        canAdd
          ? isLoggedIn
            ? "Add to cart"
            : "Add to cart"
          : totalStock !== undefined
            ? "You already reached the stock limit for this item"
            : "Out of stock"
      }
    >
      {label}
    </button>
  );
}