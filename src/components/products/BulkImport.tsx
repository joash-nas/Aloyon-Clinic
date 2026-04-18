/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/components/products/BulkImport.tsx
   Purpose:
     • Client dialog to upload & preview CSV and POST to bulk-import API.
   Changes in this version:
     • Supports an "options_json" column for configurable options.
     • Field names match server route (/api/staff/products/bulk).
     • Keeps friendly log + template download link.
   ============================================================================ */
"use client";

import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";

type Props = { open: boolean; onClose: () => void };

const RowSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  brand: z.string().optional().default(""),
  price: z.coerce.number().min(0),
  qty: z.coerce.number().int().min(0),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.coerce.boolean().optional().default(false),
  product_type: z.enum(["frames","eyedrops","solution","accessory","contact-lens"]).nullish(),
  material: z.string().nullish(),
  shape: z.string().nullish(),
  category: z.string().nullish(),
  size_ml: z.coerce.number().nullish(),
  size_count: z.coerce.number().nullish(),
  dosage: z.string().nullish(),

  primary_image_url: z.string().optional().default(""),
  image_urls: z.string().optional().default(""),

  // NEW: json string for options
  options_json: z.string().optional().default(""),
});

type ParsedRow = z.infer<typeof RowSchema>;

export default function BulkImportDialog({ open, onClose }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  if (!open) return null;

  function parseCsv(file: File) {
    setErrors([]); setRows([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const errs: string[] = [];
        const ok: ParsedRow[] = [];
        (res.data as unknown[]).forEach((raw, i) => {
          const r = RowSchema.safeParse(raw);
          if (!r.success) {
            errs.push(`Row ${i + 2}: ${r.error.issues.map(x => x.message).join("; ")}`);
          } else {
            ok.push(r.data);
          }
        });
        setErrors(errs);
        setRows(ok);
      },
    });
  }

  async function importAll() {
    if (rows.length === 0) return;
    setBusy(true); setLog("");
    try {
      const res = await fetch("/api/staff/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      setLog(`Imported/updated ${data.results?.filter((r: any) => r.ok).length ?? 0} item(s).`);
    } catch (e) {
      setLog((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white text-black dark:bg-white dark:text-black p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Bulk import products (CSV)</h2>
          <button className="btn btn-ghost" onClick={onClose}>✖️</button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCsv(f); }} />
            <a href="/api/staff/products/bulk" className="btn btn-ghost" download title="Download CSV template">
              ⬇️ Download CSV template
            </a>
          </div>

          {errors.length > 0 && (
            <div className="text-sm text-red-600 space-y-1">
              {errors.map((x, i) => <div key={i}>{x}</div>)}
            </div>
          )}
          {rows.length > 0 && (
            <div className="text-sm text-muted">Ready to import: {rows.length} row(s)</div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={importAll} disabled={busy || rows.length === 0}>
              {busy ? "Importing…" : "Import"}
            </button>
          </div>

          {log && <div className="text-sm mt-2">{log}</div>}
          <div className="text-xs text-muted">
            Columns: <code>name,slug,brand,price,qty,status,featured,product_type,material,shape,category,size_ml,size_count,dosage,primary_image_url,image_urls,options_json</code>.  
            <br />Use <code>|</code> to separate multiple <code>image_urls</code>. First non-empty becomes the thumbnail.
          </div>
        </div>
      </div>
    </div>
  );
}
