/* =============================================================================
   File: src/components/orders/OrderReceiptModal.tsx
   Purpose:
     • Animated 2-step receipt dialog shown after checkout:
         Step 1 – "Order confirmed" receipt
         Step 2 – Pickup details + clinic photo + "Save receipt"
     • Matches Aloyon Optical’s soft card / button styling.
   Used by:
     • src/app/cart/page.tsx
   ============================================================================ */

"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type OrderItem = {
  name: string;
  price: number;
  qty: number;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string; // ISO string
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  order: OrderSummary | null;
};

const CLINIC = {
  name: "Aloyon Optical",
  address: "386 J luna extension Mandaluyong City, Philippines",
  hoursLine1: "Mon–Sat 9:00 AM – 5:00 PM",
  googleMapsUrl:
    "https://maps.app.goo.gl/oaGGQVauSBLboomJA",
  // You can replace this image path with one you upload in /public
  photoSrc: "/aloyon-front.jpg",
};

export default function OrderReceiptModal({ open, onClose, order }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!open || !order) return null;

  const date = new Date(order.createdAt);
  const dateText = date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSaveReceipt = () => {
    // Simple, defense-friendly approach:
    // The browser's Print dialog lets user "Save as PDF".
    window.print();
  };

  const goNext = () => setStep(1);
  const goPrev = () => setStep(0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,16,20,0.32)" }}
    >
      <div
        className="relative w-[min(960px,100%-2rem)] rounded-3xl bg-white shadow-2xl overflow-hidden"
        ref={containerRef}
      >
        {/* Close button */}
        <button
          onClick={() => {
            setStep(0);
            onClose();
          }}
          className="absolute right-4 top-4 rounded-full w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="grid md:grid-cols-2">
          {/* LEFT: Receipt stepper */}
          <div className="border-r border-[var(--border)] bg-[var(--muted)]/40">
            {/* Simple step indicator */}
            <div className="px-6 pt-6 pb-2 flex items-center gap-2 text-xs text-muted">
              <StepDot active={step === 0}>Receipt</StepDot>
              <div className="w-8 h-px bg-[var(--border)]" />
              <StepDot active={step === 1}>Pickup details</StepDot>
            </div>

            <div
              className="relative px-6 pb-6 pt-2 overflow-hidden"
              style={{ minHeight: "340px" }}
            >
              {/* sliding panels */}
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${step === 0 ? "0%" : "-50%"})` }}
              >
                {/* Step 1 – Receipt */}
                <div className="w-1/2 pr-4">
                  <h2 className="text-lg font-semibold mb-1">Order confirmed</h2>
                  <p className="text-xs text-muted">
                    Order no. <span className="font-mono">{order.orderNumber}</span>
                    <br />
                    {dateText}
                  </p>

                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
                    <div className="px-4 py-2 text-xs font-semibold bg-[var(--muted)]">
                      Items
                    </div>
                    <div className="divide-y divide-[var(--border)] text-sm">
                      {order.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-2 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-[11px] text-muted">
                              Qty {it.qty} × ₱{it.price.toLocaleString("en-PH")}
                            </div>
                          </div>
                          <div className="font-medium whitespace-nowrap">
                            ₱{(it.price * it.qty).toLocaleString("en-PH")}
                          </div>
                        </div>
                      ))}
                      <div className="px-4 py-2 flex justify-between text-sm">
                        <span className="text-muted">Subtotal</span>
                        <span className="font-medium">
                          ₱{order.subtotal.toLocaleString("en-PH")}
                        </span>
                      </div>
                      <div className="px-4 py-2 flex justify-between text-sm">
                        <span className="text-muted">Shipping</span>
                        <span className="font-medium">Pickup – no shipping</span>
                      </div>
                      <div className="px-4 py-3 flex justify-between text-sm border-t border-[var(--border)]">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">
                          ₱{order.total.toLocaleString("en-PH")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-muted">
                    Please keep this order number. You’ll present it at the clinic for
                    pickup.
                  </p>
                </div>

                {/* Step 2 – Pickup details & Save */}
                <div className="w-1/2 pl-4">
                  <h2 className="text-lg font-semibold mb-1">Pickup details</h2>
                  <p className="text-xs text-muted mb-3">
                    This order will be ready for pickup at our main clinic.
                  </p>

                  <div className="rounded-2xl border border-[var(--border)] bg-white p-4 mb-3 text-sm">
                    <div className="font-semibold">{CLINIC.name}</div>
                    <div className="text-xs text-muted mt-1">{CLINIC.address}</div>
                    <div className="mt-2 text-xs">
                      <div>{CLINIC.hoursLine1}</div>
                    </div>
                    <Link
                      href={CLINIC.googleMapsUrl}
                      target="_blank"
                      className="mt-3 inline-flex text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      View in Google Maps →
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden mb-3">
                    <div className="px-4 py-2 text-xs font-semibold bg-[var(--muted)]">
                      Clinic front
                    </div>
                    <div className="aspect-[4/3] bg-[var(--muted)]">
                      <img
                        src={CLINIC.photoSrc}
                        alt="Aloyon Optical clinic front"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted mb-3">
                    Tip: you can save this receipt as a PDF or print a copy to bring
                    during pickup.
                  </p>

                  <button
                    onClick={handleSaveReceipt}
                    className="btn btn-ghost w-full text-sm"
                  >
                    Save / print receipt
                  </button>
                </div>
              </div>
            </div>

            {/* bottom controls */}
            <div className="px-6 pb-5 flex items-center justify-between text-xs">
              <button
                onClick={step === 0 ? onClose : goPrev}
                className="btn btn-ghost text-xs"
              >
                {step === 0 ? "Close" : "← Back"}
              </button>

              <div className="flex items-center gap-2">
                {step === 0 && (
                  <button onClick={goNext} className="btn btn-ghost text-xs">
                    Next → Pickup details
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: CTA to dashboard orders */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold mb-2">
                Track this order in your account
              </h3>
              <p className="text-sm text-muted mb-4">
                You can view all your past orders, statuses, and pickup details inside
                your patient dashboard.
              </p>

              <Link href="/dashboard/shop-orders" className="btn btn-primary w-full">
                Go to my shop orders
              </Link>

              <p className="mt-3 text-[11px] text-muted">
                Your order will start in{" "}
                <span className="font-semibold">Pending</span> status. Assistants can
                update it to <span className="font-semibold">Preparing</span>,{" "}
                <span className="font-semibold">Ready</span>, and{" "}
                <span className="font-semibold">Completed</span> as they process your
                eyewear.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="btn btn-ghost text-sm"
                onClick={() => {
                  setStep(0);
                  onClose();
                }}
              >
                Continue shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${
          active ? "bg-[var(--primary)]" : "bg-[var(--border)]"
        }`}
      />
      <span className={`uppercase tracking-wide ${active ? "font-semibold" : ""}`}>
        {children}
      </span>
    </div>
  );
}
