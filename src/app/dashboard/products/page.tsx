// src/app/dashboard/products/page.tsx
"use client";
import ProductTable from "@/components/products/ProductTable";
import { useAuth } from "@/components/auth/AuthContext";
import { isAssistant } from "@/lib/roles";
import BulkImport from "@/components/products/BulkImport";
import { useState } from "react";

export default function ProductsPage() {
  const { role } = useAuth();
  const canBulk = isAssistant(role);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>

        <div className="flex items-center gap-2">
          <a href="/dashboard/products/new" className="btn btn-primary">➕ Add product</a>
          {canBulk && (
            <button className="btn btn-ghost" onClick={() => setOpen(true)}>⬆️ Bulk import</button>
          )}
        </div>
      </div>

      <ProductTable />
      {canBulk && <BulkImport open={open} onClose={() => setOpen(false)} />}
    </div>
  );
}
