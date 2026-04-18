/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/dashboard/suppliers/[id]/order/page.tsx

import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import OrderForm from "./OrderForm";
import Guard from "@/components/auth/Guard";

async function getSupplier(id: string) {
  const db = await getDb();
  try {
    const _id = new ObjectId(id);
    const doc = await db.collection("users").findOne(
      { _id, role: "supplier" },
      { projection: { email: 1, full_name: 1 } }
    );
    if (!doc) return null;
    return {
      id,
      email: doc.email as string,
      full_name: (doc as any).full_name ?? null,
    };
  } catch {
    return null;
  }
}


export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;          // unwrap the promise
  const supplier = await getSupplier(id);

  return (
    <Guard requireAuth roles={["assistant", "doctor", "admin"]}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create Purchase Order</h1>
          {supplier ? (
            <p className="text-sm text-muted">
              Supplier:{" "}
              <span className="font-medium">
                {supplier.full_name || supplier.email}
              </span>
            </p>
          ) : (
            <p className="text-sm text-red-600">Supplier not found.</p>
          )}
        </div>

        {supplier && (
          <OrderForm
            supplierId={supplier.id}
            supplierEmail={supplier.email}
          />
        )}
      </div>
    </Guard>
  );
}
