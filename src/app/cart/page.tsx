/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/app/cart/page.tsx
   Purpose:
     • Show cart items for the logged-in patient.
     • Let the patient choose a payment method.
     • PAY_ON_PICKUP → Place order via POST /api/me/orders, then show receipt modal.
     • PAYMONGO (Online) → Create PayMongo checkout session/link then redirect to hosted PayMongo page.
   Notes:
     • Online payments happen inside PayMongo (GCash/Card/etc are chosen there).
     • For PayMongo flow, we DO NOT clear the cart immediately (avoid losing cart if user cancels).
       Recommended: clear cart on success page after verifying order is paid.
   ============================================================================ */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartContext";

type ReceiptItem = {
  productId?: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type LastOrder = {
  id?: string;
  orderNumber: string;
  createdAt: string;
  subtotal: number;
  rewardsDiscount?: number;
  pointsRedeemed?: number;
  shippingFee: number;
  total: number;
  items: ReceiptItem[];
};

type PaymentMethodCode = "PAY_ON_PICKUP" | "PAYMONGO";

type ApplyPointsResp = {
  ok: boolean;
  subtotalPhp?: number;
  availablePoints?: number;
  availablePesoValue?: number;
  maxRedeemPoints?: number;
  maxDiscountPhp?: number;
  appliedPoints?: number;
  discountPhp?: number;
  newTotal?: number;
  error?: string;
};

export default function CartPage() {
  const { items, updateQty, removeItem, clear, subtotal } = useCart();
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodCode>("PAY_ON_PICKUP");

  const [usePoints, setUsePoints] = useState(false);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [maxRedeemPoints, setMaxRedeemPoints] = useState(0);
  const [maxDiscountPhp, setMaxDiscountPhp] = useState(0);
  const [applyErr, setApplyErr] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);

  const router = useRouter();
  const hasItems = items.length > 0;

  const isOnlinePayment = paymentMethod === "PAYMONGO";

  async function loadPointsQuote() {
    if (!hasItems || subtotal <= 0 || !isOnlinePayment) {
      setAvailablePoints(0);
      setMaxRedeemPoints(0);
      setMaxDiscountPhp(0);
      return;
    }

    try {
      setLoadingQuote(true);
      setApplyErr("");

      const res = await fetch("/api/checkout/apply-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtotalPhp: subtotal, pointsToUse: 0 }),
      });

      const j = (await res.json()) as ApplyPointsResp;

      if (!res.ok || !j.ok) {
        throw new Error(j.error || "Failed to load rewards.");
      }

      setAvailablePoints(j.availablePoints ?? 0);
      setMaxRedeemPoints(j.maxRedeemPoints ?? 0);
      setMaxDiscountPhp(j.maxDiscountPhp ?? 0);
    } catch (e: any) {
      setApplyErr(e?.message || "Failed to load rewards.");
      setAvailablePoints(0);
      setMaxRedeemPoints(0);
      setMaxDiscountPhp(0);
    } finally {
      setLoadingQuote(false);
    }
  }

  useEffect(() => {
    if (!isOnlinePayment) {
      setUsePoints(false);
      setApplyErr("");
      setAvailablePoints(0);
      setMaxRedeemPoints(0);
      setMaxDiscountPhp(0);
      return;
    }

    void loadPointsQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, hasItems, paymentMethod]);

  const pointsToRedeem = isOnlinePayment && usePoints ? maxRedeemPoints : 0;
  const rewardsDiscount = isOnlinePayment && usePoints ? maxDiscountPhp : 0;
  const finalTotal = Math.max(0, subtotal - rewardsDiscount);

  async function handleCheckout() {
    if (!hasItems || placing) return;
    setPlacing(true);

    try {
      // Common items payload
      const lineItems = items.map((it) => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        unitPrice: it.price,
      }));

      // 1) PAY ON PICKUP: existing flow
      if (paymentMethod === "PAY_ON_PICKUP") {
        const payload = {
          items: lineItems,
          paymentMethod,
          pointsToUse: 0, // pickup redemption is at clinic
        };

        const res = await fetch("/api/me/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let message = "Sorry, something went wrong while placing your order.";

          try {
            const errData = await res.json();
            if (errData && typeof errData.error === "string") {
              message = errData.error;
            }
          } catch {}

          alert(message);
          return;
        }

        const data = (await res.json()) as LastOrder;

        clear();
        setLastOrder(data);
        setShowReceipt(true);

        setUsePoints(false);
        setApplyErr("");
        setAvailablePoints(0);
        setMaxRedeemPoints(0);
        setMaxDiscountPhp(0);
        return;
      }

      // 2) PAYMONGO: create checkout then redirect (do NOT clear cart yet)
      if (paymentMethod === "PAYMONGO") {
        const res = await fetch("/api/checkout/paymongo/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: lineItems,
            subtotalPhp: subtotal,          // send subtotal shown in UI
            pointsToUse: pointsToRedeem,    // send chosen points
          }),
        });

        const j = await res.json().catch(() => ({} as any));
        if (!res.ok || !j?.ok || !j?.checkoutUrl) {
          const msg = j?.error || "Failed to start PayMongo checkout.";
          alert(msg);
          return;
        }

        // store orderId for success page to finalize/clear cart
        try {
          if (j.orderId) localStorage.setItem("pm_pending_order_id", String(j.orderId));
        } catch {}

        window.location.href = j.checkoutUrl;
        return;
      }
    } catch (e) {
      console.error("Checkout error:", e);
      alert("Network error while placing your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>

      {!hasItems ? (
        <div className="card p-6">
          <p className="text-sm text-muted">Your cart is empty.</p>
          <div className="mt-3">
            <Link href="/shop" className="btn btn-primary">
              Continue shopping
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-3">
              {items.map((it) => (
                <div key={it.productId} className="card p-3 flex items-center gap-3">
                  <div className="size-20 overflow-hidden rounded-md bg-[var(--muted)]">
                    {it.image && (
                      <img
                        src={it.image}
                        alt={it.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-xs text-muted">
                      ₱{it.price.toLocaleString("en-PH")} each
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center border rounded-md">
                        <button
                          className="px-2 py-1"
                          onClick={() => updateQty(it.productId, it.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>

                        <input
                          className="w-12 text-center outline-none bg-transparent"
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            updateQty(
                              it.productId,
                              Math.max(1, Number(e.target.value))
                            )
                          }
                        />

                        <button
                          className="px-2 py-1"
                          onClick={() => updateQty(it.productId, it.qty + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <button
                        className="btn btn-ghost"
                        onClick={() => removeItem(it.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="font-semibold whitespace-nowrap">
                    ₱{(it.price * it.qty).toLocaleString("en-PH")}
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">Subtotal</div>
                <div className="font-semibold">
                  ₱{subtotal.toLocaleString("en-PH")}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Payment method
                </div>

                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="accent-[var(--primary)]"
                      value="PAY_ON_PICKUP"
                      checked={paymentMethod === "PAY_ON_PICKUP"}
                      onChange={() => setPaymentMethod("PAY_ON_PICKUP")}
                    />
                    <span>Pay on pickup</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="accent-[var(--primary)]"
                      value="PAYMONGO"
                      checked={paymentMethod === "PAYMONGO"}
                      onChange={() => setPaymentMethod("PAYMONGO")}
                    />
                    <span>Online (PayMongo)</span>
                  </label>
                </div>
              </div>

              {isOnlinePayment ? (
                <div className="rounded-2xl border border-[var(--border)] p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Use my points</div>
                      <div className="text-xs text-muted">
                        {loadingQuote
                          ? "Loading..."
                          : `${availablePoints} pts available`}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUsePoints((v) => !v)}
                      disabled={loadingQuote || maxRedeemPoints <= 0}
                      className={[
                        "relative inline-flex h-6 w-11 items-center rounded-full transition",
                        usePoints ? "bg-black" : "bg-neutral-300",
                        loadingQuote || maxRedeemPoints <= 0
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      ].join(" ")}
                      aria-pressed={usePoints}
                    >
                      <span
                        className={[
                          "inline-block h-4 w-4 transform rounded-full bg-white transition",
                          usePoints ? "translate-x-6" : "translate-x-1",
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  {applyErr ? (
                    <div className="text-xs text-rose-600">{applyErr}</div>
                  ) : null}

                  {usePoints && maxRedeemPoints > 0 ? (
                    <div className="text-xs text-muted">
                      Applying {maxRedeemPoints} pts (₱
                      {maxDiscountPhp.toLocaleString("en-PH")})
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] p-3 text-xs text-muted">
                  Rewards for pickup orders are redeemed at the clinic through patient QR scanning.
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">Points discount</div>
                <div className="font-semibold">
                  - ₱{rewardsDiscount.toLocaleString("en-PH")}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">Total</div>
                <div className="font-semibold">
                  ₱{finalTotal.toLocaleString("en-PH")}
                </div>
              </div>

              <p className="text-xs text-muted">Pickup only.</p>

              <div className="mt-2 flex gap-2">
                <button
                  className="btn btn-primary flex-1"
                  onClick={handleCheckout}
                  disabled={placing || !hasItems}
                >
                  {placing
                    ? "Processing…"
                    : paymentMethod === "PAYMONGO"
                    ? "Pay with PayMongo"
                    : "Proceed to checkout"}
                </button>

                <button onClick={clear} className="btn btn-ghost">
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div>
            <Link href="/shop" className="btn btn-ghost">
              Continue shopping
            </Link>
          </div>
        </>
      )}

      {showReceipt && lastOrder && (
        <ReceiptDialog
          order={lastOrder}
          onClose={() => setShowReceipt(false)}
          onGoToOrders={() => {
            setShowReceipt(false);
            router.push("/dashboard/shop-orders");
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Receipt modal (unchanged) ---------------- */

function ReceiptDialog({
  order,
  onClose,
  onGoToOrders,
}: {
  order: LastOrder;
  onClose: () => void;
  onGoToOrders: () => void;
}) {
  const [step, setStep] = useState<"receipt" | "pickup">("receipt");

  const created = new Date(order.createdAt);
  const dateStr = created.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const timeStr = created.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function handlePrint() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("printable-receipt");
    if (!el) return;

    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Receipt ${order.orderNumber}</title>
          <style>
            body {
              margin: 0;
              padding: 16px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
              background: #f3f4f6;
            }
            .wrap {
              max-width: 360px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-[0_22px_70px_rgba(15,23,42,0.45)] max-w-3xl w-full mx-3 sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] bg-white">
          <div className="flex items-center gap-4 text-xs font-medium tracking-wide uppercase">
            <button
              type="button"
              onClick={() => setStep("receipt")}
              className={`flex items-center gap-2 ${
                step === "receipt" ? "text-black" : "text-muted"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background:
                    step === "receipt"
                      ? "var(--primary)"
                      : "rgba(148,163,184,0.7)",
                }}
              />
              <span>Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => setStep("pickup")}
              className={`flex items-center gap-2 ${
                step === "pickup" ? "text-black" : "text-muted"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background:
                    step === "pickup"
                      ? "var(--primary)"
                      : "rgba(148,163,184,0.7)",
                }}
              />
              <span>Pickup details</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto">
          {step === "receipt" ? (
            <ReceiptStep
              order={order}
              dateStr={dateStr}
              timeStr={timeStr}
              onClose={onClose}
              onPrint={handlePrint}
              onNext={() => setStep("pickup")}
            />
          ) : (
            <PickupStep
              order={order}
              onBack={() => setStep("receipt")}
              onGoToOrders={onGoToOrders}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptStep({
  order,
  dateStr,
  timeStr,
  onClose,
  onPrint,
  onNext,
}: {
  order: LastOrder;
  dateStr: string;
  timeStr: string;
  onClose: () => void;
  onPrint: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          id="printable-receipt"
          className="bg-[#f9fafb] p-3 sm:p-4 rounded-3xl shadow-inner border border-dashed border-slate-200 w-full max-w-[320px] sm:max-w-xs"
        >
          <div className="bg-white rounded-2xl px-4 py-5 shadow-sm border border-slate-200">
            <div className="text-center mb-3">
              <div className="text-[11px] tracking-[0.25em] uppercase text-slate-500">
                Aloyon Optical
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                386 J luna extension Mandaluyong City, Philippines
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-2 mt-1 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span>Order no.</span>
                <span>{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date</span>
                <span>
                  {dateStr} • {timeStr}
                </span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-300 my-3 py-2 text-[11px] space-y-2">
              {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between gap-3">
                  <div className="max-w-[60%]">
                    <div className="truncate">{it.name}</div>
                    <div className="text-[10px] text-slate-500">
                      Qty {it.qty} × ₱{it.unitPrice.toLocaleString("en-PH")}
                    </div>
                  </div>
                  <div className="text-right">
                    ₱{it.lineTotal.toLocaleString("en-PH")}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₱{order.subtotal.toLocaleString("en-PH")}</span>
              </div>

              {(order.rewardsDiscount ?? 0) > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>Points used</span>
                    <span>{order.pointsRedeemed ?? 0} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rewards discount</span>
                    <span>
                      - ₱{(order.rewardsDiscount ?? 0).toLocaleString("en-PH")}
                    </span>
                  </div>
                </>
              ) : null}

              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Pickup – no shipping</span>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-1 mt-1 font-semibold">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>₱{order.total.toLocaleString("en-PH")}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 leading-snug">
              Please keep this order number. You&apos;ll present it at the clinic
              for pickup.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>

        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onPrint}>
            Save / print receipt
          </button>
          <button className="btn btn-primary" onClick={onNext}>
            Next — Pickup details
          </button>
        </div>
      </div>
    </div>
  );
}

function PickupStep({
  order,
  onBack,
  onGoToOrders,
}: {
  order: LastOrder;
  onBack: () => void;
  onGoToOrders: () => void;
}) {
  const usedPickupRewards =
    (order.pointsRedeemed ?? 0) <= 0 && (order.rewardsDiscount ?? 0) <= 0;

    return (
    <div className="grid gap-5 md:grid-cols-[1.1fr_1.2fr]">
      {/* LEFT */}
      <div className="card p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pickup details
        </div>

        {/* Clear manual payment explanation */}
        <div className="rounded-2xl border border-[var(--border)] p-3 bg-[var(--muted)]/30 space-y-2">
          <div className="text-sm font-semibold">Pay on pickup (manual payment)</div>
          <p className="text-sm text-muted">
            You will <strong>pay at the clinic</strong> when you claim your order.
            Please bring your order number{" "}
            <span className="font-mono">{order.orderNumber}</span>.
          </p>

          <div className="text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              What to do next
            </div>
            <ul className="mt-2 space-y-1 text-sm text-muted list-disc pl-5">
              <li>
                Wait for your order to become <strong>Ready</strong> — we’ll email you when it’s ready for pickup.
              </li>
              <li>
                Visit the clinic during business hours and show your{" "}
                <strong>order number</strong>.
              </li>
              <li>
                Pay at the counter and claim your items.
              </li>
            </ul>
          </div>
        </div>

        {usedPickupRewards ? (
          <div className="rounded-2xl border border-[var(--border)] p-3 text-xs text-muted">
            Rewards for pickup orders are redeemed at the clinic through patient QR
            scanning.
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--border)] p-3 bg-[var(--muted)]/40">
          <div className="text-sm font-semibold">Aloyon Optical – Main Clinic</div>
          <div className="text-xs text-muted mt-1">
            386 J luna extension Mandaluyong City, Philippines
          </div>
          <div className="text-xs text-muted mt-2">
            <div>Mon–Sat 9:00 AM – 5:00 PM</div>
          </div>
          <a
            href="https://maps.app.goo.gl/YMYmuD7R9cBocdDe9"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-medium"
            style={{ color: "var(--primary)" }}
          >
            View in Google Maps →
          </a>
        </div>

        <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
          <img
            src="/aloyon-front.jpg"
            alt="Aloyon Optical clinic front"
            className="w-full h-40 object-cover"
          />
        </div>

        <p className="text-[11px] text-muted">
          Your order is saved as <strong>Pending</strong>. Once it’s prepared, the
          clinic will update it to <strong>Ready</strong> for pickup.
        </p>
      </div>

      {/* RIGHT */}
      <div className="card p-4 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Track this order in your account</h3>
          <p className="text-sm text-muted">
            You can view the status anytime in your patient dashboard.
          </p>

          {/* tiny “key info” card */}
          <div className="rounded-2xl border border-[var(--border)] p-3 bg-white/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Important
            </div>
            <div className="mt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Order no.</span>
                <span className="font-mono">{order.orderNumber}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted">Payment</span>
                <span className="font-medium">Pay on pickup</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted">When to pay</span>
                <span className="font-medium">At the clinic</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <button className="btn btn-primary w-full" onClick={onGoToOrders}>
            Go to my shop orders
          </button>
          <button className="btn btn-ghost w-full" onClick={onBack}>
            ← Back to receipt
          </button>
        </div>
      </div>
    </div>
  );
}