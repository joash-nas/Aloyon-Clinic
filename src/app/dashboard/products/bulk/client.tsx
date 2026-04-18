// src/app/dashboard/products/bulk/client.tsx
"use client";

import { useState } from "react";
import BulkImport from "@/components/products/BulkImport";

export default function BulkImportClient() {
  const [open, setOpen] = useState(false); // start closed

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Open importer
      </button>
      {open && <BulkImport open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
