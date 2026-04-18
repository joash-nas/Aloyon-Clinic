/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/components/products/AddToCart.tsx
   Purpose: Full add-to-cart controls on product detail page (qty picker).
   Fix:
     • Require REAL login before adding (not just truthy `user`)
     • Redirect guest to /login?redirect=...
   ============================================================================ */
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";
import { useAuth } from "@/components/auth/AuthContext";

type Props = {
  productId: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
  /** Total stock in DB (e.g. product.qty). */
  maxQty?: number;
};

export default function AddToCart({
  productId,
  name,
  price,
  image,
  inStock,
  maxQty,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const { user } = useAuth();
  const { add, items } = useCart();

  const [qty, setQty] = useState<number>(1);

  // stricter auth check (because `user` might be a placeholder)
  const isLoggedIn = Boolean(
    user && ( (user as any).id || (user as any)._id || (user as any).email )
  );
  const needsLogin = !isLoggedIn;

  const existing = items.find((it) => it.productId === productId);
  const currentInCart = existing?.qty ?? 0;

  const totalStock =
    typeof maxQty === "number" && maxQty >= 0 ? maxQty : undefined;

  const remaining =
    totalStock !== undefined
      ? Math.max(0, totalStock - currentInCart)
      : undefined;

  const canAddMore =
    inStock && (remaining === undefined ? true : remaining > 0);

  // Disable due to stock/qty only (NOT auth). Auth redirects on click.
  const disabled = !canAddMore || qty < 1;

  const clampToAllowed = (value: number) => {
    let v = Math.max(1, value);
    if (remaining !== undefined) {
      const maxAllowed = remaining > 0 ? remaining : 1;
      v = Math.min(v, maxAllowed);
    }
    return v;
  };

  const goLogin = () => {
    const redirectTo = pathname || "/shop";
    router.push(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  };

  const dec = () => setQty((n) => clampToAllowed(n - 1));
  const inc = () => setQty((n) => clampToAllowed(n + 1));

  const onAddOnly = () => {
    // hard guard
    if (needsLogin) return goLogin();
    if (disabled) return;

    const finalQty = clampToAllowed(qty);
    add({ productId, name, price, image, qty: finalQty });
  };

  const onAddAndGo = () => {
    // hard guard
    if (needsLogin) return goLogin();
    if (disabled) return;

    const finalQty = clampToAllowed(qty);
    add({ productId, name, price, image, qty: finalQty });
    router.push("/cart");
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center border rounded-md">
          <button
            type="button"
            className="px-3 py-2 disabled:opacity-50"
            onClick={dec}
            aria-label="Decrease quantity"
            disabled={disabled || needsLogin}
            title={needsLogin ? "Sign in to adjust quantity" : undefined}
          >
            −
          </button>

          <input
            className="w-12 text-center outline-none bg-transparent"
            type="number"
            min={1}
            value={qty}
            disabled={disabled || needsLogin}
            onChange={(e) =>
              setQty(clampToAllowed(Number(e.target.value) || 1))
            }
          />

          <button
            type="button"
            className="px-3 py-2 disabled:opacity-50"
            onClick={inc}
            aria-label="Increase quantity"
            disabled={disabled || needsLogin}
            title={needsLogin ? "Sign in to adjust quantity" : undefined}
          >
            +
          </button>
        </div>

        <button className="btn btn-primary" disabled={disabled} onClick={onAddOnly}>
          {needsLogin ? "Add to cart" : canAddMore ? "Add to cart" : "Max reached"}
        </button>

        <button className="btn btn-ghost" disabled={disabled} onClick={onAddAndGo}>
          {needsLogin ? "Add & view cart" : "Add & view cart"}
        </button>
      </div>

      {needsLogin ? (
        <p className="text-xs text-muted">
          Please sign in to add items to your cart.
        </p>
      ) : totalStock !== undefined ? (
        <p className="text-xs text-muted">
          {remaining === 0
            ? `You already have the maximum available quantity (${totalStock}) in your cart.`
            : `In stock: ${totalStock}. You can add up to ${remaining} more.`}
        </p>
      ) : null}
    </div>
  );
}