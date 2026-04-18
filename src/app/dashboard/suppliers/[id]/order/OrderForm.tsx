/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/suppliers/[id]/order/OrderForms.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ItemRow = {
  name: string;
  qty: number;
  price: number;
  isOther?: boolean; // flag kung custom/manual item (para sa lens supplier)
};

const LENS_GROUPS = [
  {
    group: "Single Vision",
    items: [
      "Ordinary",
      "Multicoated",
      "Blue lens",
      "Transition Multicoated",
      "Transition blue lens",
    ],
  },
  {
    group: "Double Vision",
    items: [
      "Ordinary",
      "Multicoated",
      "Blue lens",
      "Transition Multicoated",
      "Transition Blue lens",
    ],
  },
  {
    group: "Progressive",
    items: [
      "Ordinary",
      "Multicoated",
      "Blue lens",
      "Transition Multicoated",
      "Transition Blue lens",
    ],
  },
];

export default function OrderForm({
  supplierId,
  supplierEmail,
}: {
  supplierId: string;
  supplierEmail?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([
    { name: "", qty: 1, price: 0, isOther: false },
  ]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // TRUE lang kung lens supplier (dito lang lalabas ang dropdown)
  const isLensSupplier =
    (supplierEmail || "").toLowerCase().trim() === "naswashingtonhouse@gmail.com";

  function update(idx: number, patch: Partial<ItemRow>) {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((list) => [...list, { name: "", qty: 1, price: 0, isOther: false }]);
  }

  function removeRow(idx: number) {
    setItems((list) => list.filter((_, i) => i !== idx));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const clean = items
        .map((i) => ({
          name: i.name.trim(),
          qty: Number(i.qty),
          price: Number(i.price),
        }))
        .filter((i) => i.name && i.qty > 0);

      if (clean.length === 0) throw new Error("Add at least one item.");

      const res = await fetch("/api/assistant/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          supplierEmail: supplierEmail ?? undefined,
          items: clean,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({}))).error || `Failed (${res.status})`,
        );
      }

      const j = await res.json();
      setOk(`PO created: ${j.poNumber}`);
      // Optional redirect:
      // router.push("/dashboard/orders");
    } catch (e: any) {
      setErr(e?.message || "Failed to create PO");
    } finally {
      setBusy(false);
    }
  }

  const total = items.reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 font-medium">Items</div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              {/* LEFT COLUMN: depende kung lens supplier o hindi */}
              <div className="col-span-6 space-y-1">
                {isLensSupplier ? (
                  <>
                    {/* LENS DROPDOWN */}
                    <select
                      className="w-full rounded border px-2 py-2"
                      value={it.isOther ? "__other" : it.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__other") {
                          // custom/manual item
                          update(i, { isOther: true, name: "" });
                        } else {
                          // lens from list – store full name (e.g. "Progressive - Ordinary")
                          update(i, { isOther: false, name: v });
                        }
                      }}
                    >
                      <option value="">Select lens…</option>
                      {LENS_GROUPS.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map((label) => {
                            const full = `${g.group} - ${label}`;
                            return (
                              <option key={full} value={full}>
                                {full}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                      <option value="__other">Other (type manually)</option>
                    </select>

                    {/* Extra input kung "Other" */}
                    {it.isOther && (
                      <input
                        className="w-full rounded border px-2 py-2"
                        placeholder="Type custom item name"
                        value={it.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                    )}
                  </>
                ) : (
                  // NON-LENS SUPPLIER: normal text input lang
                  <input
                    className="w-full rounded border px-2 py-2"
                    placeholder="Item name"
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                )}
              </div>

              {/* QTY */}
              <input
                type="number"
                className="col-span-2 rounded border px-2 py-2"
                placeholder="Qty"
                min={1}
                value={it.qty}
                onChange={(e) => update(i, { qty: Number(e.target.value) })}
              />

              {/* PRICE */}
              <input
                type="number"
                className="col-span-3 rounded border px-2 py-2"
                placeholder="Price"
                min={0}
                step={0.01}
                value={it.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
              />

              {/* REMOVE BUTTON */}
              <button
                className="col-span-1 rounded border px-2"
                onClick={() => removeRow(i)}
                disabled={items.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button
            className="rounded bg-black px-3 py-2 text-sm text-white"
            onClick={addRow}
          >
            Add item
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border bg-white p-4">
        <div className="font-medium">Notes</div>
        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder="Optional notes for the supplier"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Bottom bar: Total + Back + Create */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          Total:{" "}
          <span className="font-semibold">
            ₱{total.toLocaleString("en-PH")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded px-3 py-2 text-sm ring-1 ring-[var(--border)] hover:bg-neutral-50"
          >
            ← Back
          </button>

          <button
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create Purchase Order"}
          </button>
        </div>
      </div>

      {err && (
        <div className="text-sm" style={{ color: "#b10d0d" }}>
          {err}
        </div>
      )}
      {ok && <div className="text-sm text-green-700">{ok}</div>}
    </div>
  );
}
