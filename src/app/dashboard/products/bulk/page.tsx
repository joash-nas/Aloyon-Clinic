// src/app/dashboard/products/bulk/page.tsx
import BulkImportClient from "./client";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Bulk import</h1>

      
      <a href="/api/staff/products/bulk/template" className="btn btn-ghost">
        ⬇️ Download CSV template
      </a>

      {/* All interactivity stays inside the client component */}
      <BulkImportClient />
    </div>
  );
}
