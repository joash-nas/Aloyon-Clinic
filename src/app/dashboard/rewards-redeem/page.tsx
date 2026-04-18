/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import QrScanner from "@/components/qr/QrScanner";

type ResolvePatientResp = {
  ok: boolean;
  patient?: {
    id: string;
    name: string;
    email?: string | null;
  };
  rewards?: {
    ok: boolean;
    points?: number;
    pesoValue?: number;
    expiresAt?: string | null;
    expired?: boolean;
  };
  error?: string;
};

type PatientOrder = {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail?: string | null;
  status: string;
  subtotal: number;
  total: number;
  paymentMethod: string;
  rewardsDiscount?: number;
  pointsRedeemed?: number;
  createdAt?: string | null;
  items: { name: string; qty: number }[];
};

type PatientOrdersResp = {
  ok: boolean;
  items?: PatientOrder[];
  error?: string;
};

type ApplyRewardsResp = {
  ok: boolean;
  redeemedPoints?: number;
  rewardsDiscount?: number;
  newOrderTotal?: number;
  newBalancePoints?: number;
  error?: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusLabel(s?: string) {
  const v = String(s || "").toLowerCase();
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function isAcceptableManualInput(value: string) {
  const v = value.trim();

  return (
    /^ALOYON:PT:[a-f\d]{32}$/i.test(v) || // full token QR text
    /^ALYON_PATIENT:[a-f\d]{24}$/i.test(v) || // old full userId QR text
    /^[a-f\d]{32}$/i.test(v) || // raw token
    /^[a-f\d]{24}$/i.test(v) // raw userId
  );
}

export default function RewardsRedeemPage() {
  const [qr, setQr] = useState("");
  const [showBackup, setShowBackup] = useState(false);

  const [patientLoading, setPatientLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const [patientErr, setPatientErr] = useState<string | null>(null);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const [resolvedPatient, setResolvedPatient] =
    useState<ResolvePatientResp | null>(null);

  const [orders, setOrders] = useState<PatientOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  const manualLooksValid = useMemo(() => isAcceptableManualInput(qr), [qr]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  const suggestedPoints = Math.min(
    Number(resolvedPatient?.rewards?.points || 0),
    Math.floor(Number(selectedOrder?.subtotal || 0) * 0.2)
  );

  const canApply =
    !!resolvedPatient?.patient?.id &&
    !!selectedOrder &&
    selectedOrder.paymentMethod === "Pay on pickup" &&
    Number(selectedOrder.pointsRedeemed || 0) <= 0 &&
    Number(selectedOrder.rewardsDiscount || 0) <= 0 &&
    suggestedPoints > 0;

  async function loadPatientOrders(patientId: string) {
    try {
      setOrdersLoading(true);
      setOrdersErr(null);
      setOrders([]);
      setSelectedOrderId("");

      const res = await fetch(
        `/api/staff/orders/by-patient?patientId=${encodeURIComponent(patientId)}`,
        { cache: "no-store" }
      );

      const j = (await res.json()) as PatientOrdersResp;

      if (!res.ok || !j.ok) {
        throw new Error(j.error || "Failed to load patient orders.");
      }

      const nextOrders = j.items || [];
      setOrders(nextOrders);

      const firstEligible = nextOrders.find(
        (o) =>
          o.paymentMethod === "Pay on pickup" &&
          Number(o.pointsRedeemed || 0) <= 0 &&
          Number(o.rewardsDiscount || 0) <= 0
      );

      if (firstEligible) {
        setSelectedOrderId(firstEligible.id);
      }
    } catch (e: any) {
      setOrdersErr(e?.message || "Failed to load patient orders.");
      setOrders([]);
      setSelectedOrderId("");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function resolvePatientQr(nextQr?: string) {
    const value = (nextQr ?? qr).trim();
    if (!value) return;

    try {
      setPatientLoading(true);
      setPatientErr(null);
      setApplyErr(null);
      setApplyMsg(null);
      setResolvedPatient(null);
      setOrders([]);
      setSelectedOrderId("");

      const res = await fetch("/api/staff/rewards/resolve-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: value }),
      });

      const j = (await res.json()) as ResolvePatientResp;

      if (!res.ok || !j.ok || !j.patient?.id) {
        throw new Error(j.error || "Failed to resolve patient.");
      }

      setResolvedPatient(j);
      await loadPatientOrders(j.patient.id);
    } catch (e: any) {
      setPatientErr(e?.message || "Failed to resolve patient.");
      setResolvedPatient(null);
    } finally {
      setPatientLoading(false);
    }
  }

  async function applyPickupRewards() {
    if (!resolvedPatient?.patient?.id || !selectedOrder) return;

    try {
      setApplyLoading(true);
      setApplyErr(null);
      setApplyMsg(null);

      const res = await fetch(
        `/api/staff/orders/${selectedOrder.id}/apply-rewards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: resolvedPatient.patient.id,
            points: suggestedPoints,
          }),
        }
      );

      const j = (await res.json()) as ApplyRewardsResp;

      if (!res.ok || !j.ok) {
        throw new Error(j.error || "Failed to apply rewards.");
      }

      setApplyMsg(
        `Applied ${j.redeemedPoints} pts (₱${j.rewardsDiscount}). New payable: ₱${j.newOrderTotal}.`
      );

      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                pointsRedeemed: j.redeemedPoints ?? 0,
                rewardsDiscount: j.rewardsDiscount ?? 0,
                total: j.newOrderTotal ?? o.total,
              }
            : o
        )
      );

      setResolvedPatient((prev) =>
        prev
          ? {
              ...prev,
              rewards: {
                ok: prev.rewards?.ok ?? true,
                points: j.newBalancePoints ?? 0,
                pesoValue: j.newBalancePoints ?? 0,
                expiresAt: prev.rewards?.expiresAt ?? null,
                expired: prev.rewards?.expired ?? false,
              },
            }
          : prev
      );
    } catch (e: any) {
      setApplyErr(e?.message || "Failed to apply rewards.");
    } finally {
      setApplyLoading(false);
    }
  }

  const handleScanResult = async (text: string) => {
    const cleaned = String(text || "").trim();
    setQr(cleaned);
    setPatientErr(null);
    await resolvePatientQr(cleaned);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Redeem patient rewards
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Scan the patient QR to view their unpaid pickup orders.
        </p>
      </div>

      <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5 space-y-4">
        <QrScanner onResult={handleScanResult} paused={patientLoading} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowBackup((v) => !v)}
            className="px-4 py-2 rounded-xl ring-1 ring-[var(--border)] text-sm"
          >
            {showBackup ? "Hide backup input" : "QR not working?"}
          </button>
        </div>

        {showBackup ? (
          <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
            <div className="text-sm font-semibold">Backup input</div>

            <textarea
              value={qr}
              onChange={(e) => setQr(e.target.value)}
              placeholder={
                "Paste full QR text, raw token, or patient ID\n\nExamples:\nALOYON:PT:abc123...\nALYON_PATIENT:6812...\nabc123...\n6812..."
              }
              className="w-full min-h-[140px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resolvePatientQr()}
                disabled={patientLoading || !manualLooksValid}
                className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
              >
                {patientLoading ? "Loading..." : "Resolve patient"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQr("");
                  setResolvedPatient(null);
                  setPatientErr(null);
                  setOrders([]);
                  setSelectedOrderId("");
                }}
                className="px-4 py-2 rounded-xl ring-1 ring-[var(--border)] text-sm"
              >
                Clear
              </button>
            </div>

            <div className="text-[11px] text-neutral-500">
              Accepted backup input: full QR text, raw token, or raw patient ID.
            </div>
          </div>
        ) : null}

        {patientErr ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm">
            {patientErr}
          </div>
        ) : null}
      </div>

      {resolvedPatient?.ok && resolvedPatient.patient ? (
        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5 space-y-3">
          <div className="text-sm font-semibold">Patient</div>

          <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
            <div className="text-sm font-medium">
              {resolvedPatient.patient.name}
            </div>
            <div className="text-xs text-neutral-500">
              {resolvedPatient.patient.email || "—"}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <div className="text-xs text-neutral-500">Available points</div>
                <div className="text-2xl font-semibold">
                  {resolvedPatient.rewards?.points ?? 0}
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Expires on</div>
                <div className="text-sm">
                  {fmtDate(resolvedPatient.rewards?.expiresAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resolvedPatient?.patient ? (
        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Unpaid pickup orders</div>
              <div className="text-xs text-neutral-500">
                Select the order where the discount should be applied.
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                resolvedPatient.patient?.id &&
                loadPatientOrders(resolvedPatient.patient.id)
              }
              disabled={ordersLoading}
              className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] text-sm disabled:opacity-50"
            >
              {ordersLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {ordersErr ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm">
              {ordersErr}
            </div>
          ) : null}

          {ordersLoading ? (
            <div className="text-sm text-neutral-500">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-neutral-500">
              No unpaid pickup orders found for this patient.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const alreadyUsed =
                  Number(o.pointsRedeemed || 0) > 0 ||
                  Number(o.rewardsDiscount || 0) > 0;

                const summary =
                  (o.items || [])
                    .map((it) => `${it.name} (x${it.qty})`)
                    .join(", ") || "—";

                const active = selectedOrderId === o.id;

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={[
                      "w-full text-left rounded-2xl border p-4 transition",
                      active
                        ? "border-black ring-1 ring-black bg-black/[0.03]"
                        : "border-[var(--border)] hover:bg-black/[0.02]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {o.orderNumber}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {statusLabel(o.status)} • {fmtDate(o.createdAt)}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {summary}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">
                          ₱{o.total.toLocaleString("en-PH")}
                        </div>
                        {alreadyUsed ? (
                          <div className="text-[11px] text-emerald-700 mt-1">
                            Rewards already applied
                          </div>
                        ) : (
                          <div className="text-[11px] text-neutral-500 mt-1">
                            Pickup unpaid
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5 space-y-3">
          <div className="text-sm font-semibold">Apply rewards</div>

          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm space-y-1">
            <div>
              Selected order: <b>{selectedOrder.orderNumber}</b>
            </div>
            <div>
              Subtotal: ₱<b>{selectedOrder.subtotal.toLocaleString("en-PH")}</b>
            </div>
            <div>
              Suggested redemption: <b>{suggestedPoints}</b> pts
            </div>
            <div>
              Discount: ₱<b>{suggestedPoints.toLocaleString("en-PH")}</b>
            </div>
            <div>
              New payable: ₱
              <b>
                {Math.max(0, selectedOrder.subtotal - suggestedPoints).toLocaleString("en-PH")}
              </b>
            </div>
          </div>

          <button
            type="button"
            onClick={applyPickupRewards}
            disabled={!canApply || applyLoading}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
          >
            {applyLoading ? "Applying..." : "Apply to selected order"}
          </button>

          {applyMsg ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 text-sm">
              {applyMsg}
            </div>
          ) : null}

          {applyErr ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm">
              {applyErr}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}