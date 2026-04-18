"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/cart/CartContext";

type OrderStatusResp = {
  ok: boolean;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    payment?: { state?: "unpaid" | "paid"; paidAt?: string | null };
    total?: number;
    subtotal?: number;
    rewardsDiscount?: number;
    pointsRedeemed?: number;
    items?: { name: string; qty: number; unitPrice?: number; lineTotal?: number }[];
  };
  error?: string;
};

function Pill({
  active,
  done,
  children,
}: {
  active?: boolean;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : active
          ? "border-slate-200 bg-white text-slate-900"
          : "border-slate-200 bg-slate-50 text-slate-500",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex size-4 items-center justify-center rounded-full text-[10px]",
          done
            ? "bg-emerald-600 text-white"
            : active
            ? "bg-slate-900 text-white"
            : "bg-slate-300 text-white",
        ].join(" ")}
      >
        {done ? "✓" : "•"}
      </span>
      {children}
    </div>
  );
}

export default function PaymongoSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = sp.get("orderId");

  const { clear } = useCart();

  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState("Confirming your payment…");
  const [order, setOrder] = useState<OrderStatusResp["order"] | null>(null);

  const formattedTotal = useMemo(() => {
    if (!order || typeof order.total !== "number") return "—";
    return `₱${order.total.toLocaleString("en-PH")}`;
  }, [order]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setMsg("Missing orderId.");
      return;
    }

    let cancelled = false;
    let tries = 0;

    async function poll() {
      tries++;

      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        const j = (await res.json()) as OrderStatusResp;

        if (!res.ok || !j.ok || !j.order) {
          throw new Error(j.error || "Failed to check order status.");
        }

        if (cancelled) return;

        setOrder(j.order);

        const state = j.order.payment?.state;

        if (state === "paid") {
          setPaid(true);
          setLoading(false);
          setMsg("Payment confirmed.");

          // clear cart now that payment is confirmed
          clear();

          try {
            localStorage.removeItem("pm_pending_order_id");
          } catch {}

          return;
        }

        if (tries >= 12) {
          setLoading(false);
          setMsg("Payment is still processing. You may refresh or check your orders.");
          return;
        }

        setTimeout(poll, 1500);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setMsg(e?.message || "Something went wrong while confirming payment.");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId, clear]);

  const orderLabel = order?.orderNumber || (orderId ? `#${orderId}` : "—");

  return (
    <div className="min-h-[70vh] px-4 py-14">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Aloyon Optical
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              {paid ? "Payment Successful" : "Processing Payment"}
            </h1>
            <p className="mt-1 text-sm text-muted">{msg}</p>
          </div>

          {/* Stepper pills */}
          <div className="flex flex-wrap gap-2">
            <Pill done>Checkout</Pill>
            <Pill active={!paid} done={paid}>
              Verification
            </Pill>
            <Pill done={paid}>Complete</Pill>
          </div>
        </div>

        {/* Main card */}
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.12)]">
          {/* subtle gradient glow */}
          <div className="pointer-events-none absolute -top-28 right-[-120px] h-[280px] w-[280px] rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-[-120px] h-[280px] w-[280px] rounded-full bg-slate-200/60 blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:grid md:grid-cols-[1.05fr_0.95fr] md:items-start">
              {/* Left */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex size-12 items-center justify-center rounded-2xl",
                      paid
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    <span className="text-xl">{paid ? "✓" : "…"}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {paid ? "Confirmed" : "Verifying payment"}
                    </div>
                    <div className="text-xs text-muted">
                      {paid
                        ? "Your payment was received successfully."
                        : "Please wait a moment. This usually takes a few seconds."}
                    </div>
                  </div>
                </div>

                {/* Receipt */}
                <div className="rounded-3xl border border-dashed border-slate-200 bg-[#f9fafb] p-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                          Order
                        </div>
                        <div className="mt-1 font-semibold">{orderLabel}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                          Total paid
                        </div>
                        <div className="mt-1 font-semibold">{formattedTotal}</div>
                      </div>
                    </div>

                    <div className="my-4 border-t border-dashed border-slate-200" />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Payment method</span>
                      <span className="font-medium">PayMongo</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted">Payment status</span>
                      <span
                        className={[
                          "font-medium",
                          paid ? "text-emerald-700" : "text-slate-700",
                        ].join(" ")}
                      >
                        {paid ? "Paid" : "Processing"}
                      </span>
                    </div>
                    
                    {order ? (
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Subtotal</span>
                        <span className="font-medium">
                          ₱{Number(order.subtotal || 0).toLocaleString("en-PH")}
                        </span>
                      </div>

                      {Number(order.rewardsDiscount || 0) > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted">
                            Rewards discount{Number(order.pointsRedeemed || 0) > 0 ? ` (${order.pointsRedeemed} pts)` : ""}
                          </span>
                          <span className="font-medium text-emerald-700">
                            - ₱{Number(order.rewardsDiscount || 0).toLocaleString("en-PH")}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
                        <span className="text-muted">Total paid</span>
                        <span className="font-semibold">
                          ₱{Number(order.total || 0).toLocaleString("en-PH")}
                        </span>
                      </div>
                    </div>
                  ) : null}

                    {paid && order?.payment?.paidAt ? (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted">Paid at</span>
                        <span className="font-medium">
                          {new Date(order.payment.paidAt).toLocaleString("en-PH")}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-4 text-[10px] text-slate-500">
                      Keep your order number for pickup verification.
                    </div>
                  </div>
                </div>

                {!paid ? (
                  <div className="text-xs text-muted">
                    If it stays here for too long, click{" "}
                    <span className="font-medium">Refresh</span> or check your orders.
                  </div>
                ) : null}
              </div>

              {/* Right */}
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Next steps
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <div className="flex gap-2">
                      <span className="mt-[2px]">•</span>
                      <span>
                        Visit{" "}
                        <span className="font-medium text-slate-900">My Shop Orders</span>{" "}
                        to track status.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="mt-[2px]">•</span>
                      <span>Pickup at the clinic during business hours.</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      className="btn btn-primary w-full"
                      onClick={() => router.push("/")}
                      disabled={loading && !paid}
                      title={loading && !paid ? "Please wait for confirmation…" : ""}
                    >
                      Go Home
                    </button>

                    <Link href="/dashboard/shop-orders" className="btn btn-ghost w-full">
                      View my orders
                    </Link>

                    {!paid ? (
                      <button
                        className="btn btn-ghost w-full"
                        onClick={() => window.location.reload()}
                      >
                        Refresh status
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-[var(--muted)]/30 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pickup
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    Aloyon Optical – Main Clinic
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    386 J luna extension Mandaluyong City, Philippines
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Mon–Sat • 9:00 AM – 5:00 PM
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
              </div>
            </div>

            {/* Footer strip */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Tip: If you paid but verification is delayed, your order will still appear in{" "}
              <span className="font-medium text-slate-900">My Shop Orders</span> once confirmed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessSkeleton() {
  return (
    <div className="min-h-[70vh] px-4 py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3">
          <div className="h-3 w-40 rounded bg-[var(--muted)]" />
          <div className="h-8 w-64 rounded bg-[var(--muted)]" />
          <div className="h-4 w-full rounded bg-[var(--muted)]" />
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-[var(--muted)]" />
              <div className="h-4 w-40 rounded bg-[var(--muted)]" />
              <div className="h-4 w-72 rounded bg-[var(--muted)]" />
              <div className="h-44 w-full rounded-3xl bg-[var(--muted)]" />
            </div>
            <div className="space-y-3">
              <div className="h-28 w-full rounded-3xl bg-[var(--muted)]" />
              <div className="h-36 w-full rounded-3xl bg-[var(--muted)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}