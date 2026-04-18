"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymongoCancelPage() {
  return (
    <Suspense fallback={<CancelSkeleton />}>
      <CancelInner />
    </Suspense>
  );
}

function CancelInner() {
  const sp = useSearchParams();
  const orderId = sp.get("orderId");

  return (
    <div className="max-w-xl mx-auto py-14 px-4">
      <div className="card p-6 space-y-3">
        <h1 className="text-xl font-semibold">Payment Cancelled</h1>
        <p className="text-sm text-muted">
          Your PayMongo checkout was cancelled. Your cart items were kept.
        </p>

        {orderId ? (
          <p className="text-xs text-muted">Order ID: {orderId}</p>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Link href="/cart" className="btn btn-primary">
            Back to cart
          </Link>
          <Link href="/" className="btn btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function CancelSkeleton() {
  return (
    <div className="max-w-xl mx-auto py-14 px-4">
      <div className="card p-6 space-y-3">
        <div className="h-6 w-48 rounded bg-[var(--muted)]" />
        <div className="h-4 w-full rounded bg-[var(--muted)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--muted)]" />
        <div className="pt-2 flex gap-2">
          <div className="h-10 w-32 rounded bg-[var(--muted)]" />
          <div className="h-10 w-24 rounded bg-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}